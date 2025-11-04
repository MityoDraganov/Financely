import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { logger } from "firebase-functions";

interface RegenerateSitePayload {
  brandSiteId: string;
  sectionType?: "hero" | "about" | "features" | "contact";
}

/**
 * Firebase Cloud Function for initiating brand site regeneration.
 *
 * This function returns immediately after updating the brand site document.
 * The actual regeneration (AI, deployment) is processed asynchronously
 * by a Firestore trigger.
 *
 * Request payload:
 * {
 *   brandSiteId: string,
 *   sectionType?: "hero" | "about" | "features" | "contact"
 * }
 *
 * Response: { success: true, brandSiteId: string, status: "pending" }
 *
 * The frontend should poll the brand site document to check status updates.
 */
export const regenerateSite = onCall<RegenerateSitePayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60, // Fast response - just updates document
    memory: "256MiB",
  },
  async (request) => {
    try {
      const { brandSiteId, sectionType } = request.data;

      if (!brandSiteId) {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      logger.info("Initiating site regeneration", {
        brandSiteId,
        sectionType,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      // Update document with status "pending" to trigger async processing
      // Store sectionType in metadata so handleGenerateSite can use it
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          status: "pending",
          error: undefined, // Clear any previous errors
          metadata: {
            ...(brandSite.metadata || {}),
            version: brandSite.metadata?.version || 1,
            generatedAt: brandSite.metadata?.generatedAt,
            model: brandSite.metadata?.model,
            regenerateSectionType: sectionType, // Store section type for async handler
          },
        },
      });

      logger.info("Site regeneration initiated", {
        brandSiteId,
        sectionType,
        status: "pending",
      });

      return {
        success: true,
        brandSiteId,
        status: "pending",
      };
    } catch (error) {
      logger.error("Error initiating site regeneration", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to initiate site regeneration",
      );
    }
  },
);

