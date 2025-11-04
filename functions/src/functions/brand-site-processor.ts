import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { handleGenerateSite } from "../app/handle-generate-site";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");
const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

/**
 * Firestore trigger that processes brand site generation asynchronously.
 * This runs when a brand site document is created or updated with status "pending".
 */
export const onBrandSiteCreated = onDocumentCreated(
  {
    document: "brandSites/{brandSiteId}",
    region: "us-central1",
    secrets: [
      geminiApiKey,
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
    timeoutSeconds: 540, // 9 minutes max
    memory: "1GiB",
  },
  async (event) => {
    const brandSiteData = event.data?.data();
    if (!brandSiteData) {
      logger.warn("No brand site data in event");
      return;
    }

    const brandSiteId = event.params.brandSiteId;
    const status = brandSiteData.status;

    // Only process if status is "pending"
    if (status !== "pending") {
      logger.info("Brand site not in pending status, skipping", {
        brandSiteId,
        status,
      });
      return;
    }

    logger.info("Processing brand site generation", {
      brandSiteId,
      organizationId: brandSiteData.organizationId,
    });

    try {
      // Note: handleGenerateSite will find the existing brand site by organizationId
      await handleGenerateSite(
        {
          organizationId: brandSiteData.organizationId,
          brandName: brandSiteData.brandName,
          tone: brandSiteData.tone,
        },
        {
          geminiApiKey: geminiApiKey.value(),
          cloudflareApiToken: cloudflareApiToken.value(),
          cloudflareZoneId: cloudflareZoneId.value(),
          cloudflareBaseDomain: cloudflareBaseDomain.value(),
          firebaseProjectId: firebaseProjectId.value(),
        },
      );

      logger.info("Brand site generation completed successfully", {
        brandSiteId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to process brand site generation", {
        brandSiteId,
        error: errorMessage,
      });

      // Update the brand site with error status
      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      try {
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            status: "failed",
            error: errorMessage,
          },
        });
      } catch (updateError) {
        logger.error("Failed to update brand site with error status", {
          brandSiteId,
          updateError: updateError instanceof Error ? updateError.message : "Unknown error",
        });
      }
    }
  },
);

/**
 * Also handle updates in case status is manually reset to "pending"
 */
export const onBrandSiteUpdated = onDocumentUpdated(
  {
    document: "brandSites/{brandSiteId}",
    region: "us-central1",
    secrets: [
      geminiApiKey,
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    const brandSiteId = event.params.brandSiteId;
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    // Only process if status changed TO "pending" (wasn't pending before)
    if (beforeStatus === "pending" || afterStatus !== "pending") {
      return;
    }

    logger.info("Brand site status changed to pending, processing", {
      brandSiteId,
      beforeStatus,
      afterStatus,
    });

    try {
      await handleGenerateSite(
        {
          organizationId: afterData.organizationId,
          brandName: afterData.brandName,
          tone: afterData.tone,
        },
        {
          geminiApiKey: geminiApiKey.value(),
          cloudflareApiToken: cloudflareApiToken.value(),
          cloudflareZoneId: cloudflareZoneId.value(),
          cloudflareBaseDomain: cloudflareBaseDomain.value(),
          firebaseProjectId: firebaseProjectId.value(),
        },
      );

      logger.info("Brand site regeneration completed successfully", {
        brandSiteId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to process brand site regeneration", {
        brandSiteId,
        error: errorMessage,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      try {
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            status: "failed",
            error: errorMessage,
          },
        });
      } catch (updateError) {
        logger.error("Failed to update brand site with error status", {
          brandSiteId,
          updateError: updateError instanceof Error ? updateError.message : "Unknown error",
        });
      }
    }
  },
);

