import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";

const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");
const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface AddCustomDomainPayload {
  brandSiteId: string;
  customDomain: string;
}

/**
 * Add a custom domain to a brand site.
 */
export const addCustomDomain = onCall<AddCustomDomainPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300, // 5 minutes for DNS propagation
    memory: "512MiB",
    secrets: [
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
  },
  async (request) => {
    try {
      const { brandSiteId, customDomain } = request.data;

      if (!brandSiteId || !customDomain) {
        throw new HttpsError(
          "invalid-argument",
          "brandSiteId and customDomain are required",
        );
      }

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      if (!brandSite.deployedUrl) {
        throw new HttpsError(
          "failed-precondition",
          "Site must be deployed before adding custom domain",
        );
      }

      const cloudflareService = new CloudflareService({
        apiToken: cloudflareApiToken.value(),
        zoneId: cloudflareZoneId.value(),
        baseDomain: cloudflareBaseDomain.value(),
      });

      const hostingService = new FirebaseHostingService({
        projectId: firebaseProjectId.value(),
      });

      const siteId = `brand-${brandSiteId}`;
      const targetHost = new URL(brandSite.deployedUrl).hostname;

      await cloudflareService.createCustomDomainRecord(customDomain, targetHost);
      await hostingService.addCustomDomain(siteId, customDomain);

      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          customDomain,
        },
      });

      logger.info("Custom domain added successfully", {
        brandSiteId,
        customDomain,
      });

      return {
        success: true,
        customDomain,
      };
    } catch (error) {
      logger.error("Error adding custom domain", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "Failed to add custom domain",
      );
    }
  },
);

