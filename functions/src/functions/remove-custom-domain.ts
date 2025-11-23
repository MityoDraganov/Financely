import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { CloudflarePublisherService } from "../services/cloudflare-publisher-service";
import { logger } from "firebase-functions";

const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");
const cloudflareAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cloudflareR2BucketName = defineSecret("CLOUDFLARE_R2_BUCKET_NAME");
const cloudflareKvNamespaceId = defineSecret("CLOUDFLARE_KV_NAMESPACE_ID");
const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface RemoveCustomDomainPayload {
  brandSiteId: string;
  customDomain: string;
}

/**
 * Remove a custom domain from a brand site.
 * Handles both Cloudflare and Firebase Hosting providers.
 */
export const removeCustomDomain = onCall<RemoveCustomDomainPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      cloudflareAccountId,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
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

      // Clean domain
      let cleanDomain = customDomain.trim().toLowerCase();
      cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      cleanDomain = cleanDomain.replace(/\/$/, "");

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      if (brandSite.customDomain !== cleanDomain) {
        throw new HttpsError(
          "invalid-argument",
          "Custom domain does not match the brand site's custom domain",
        );
      }

      const hostingProvider = brandSite.hostingProvider || "firebase";
      const siteId = `brand-${brandSiteId}`;

      // Remove domain based on hosting provider
      if (hostingProvider === "cloudflare") {
        // Remove from Cloudflare KV mapping
        const publisherService = new CloudflarePublisherService({
          accountId: cloudflareAccountId.value(),
          apiToken: cloudflareApiToken.value(),
          r2BucketName: cloudflareR2BucketName.value(),
          kvNamespaceId: cloudflareKvNamespaceId.value(),
        });

        try {
          await publisherService.deleteSiteHostMapping(cleanDomain);
          logger.info("Custom domain removed from Cloudflare KV mapping", {
            brandSiteId,
            domain: cleanDomain,
          });
        } catch (kvError) {
          logger.warn("Failed to remove domain from Cloudflare KV (may not exist)", {
            brandSiteId,
            domain: cleanDomain,
            error: kvError instanceof Error ? kvError.message : "Unknown error",
          });
          // Continue with removal even if KV deletion fails
        }

        // Remove Cloudflare Workers route and custom hostname
        const cloudflareService = new CloudflareService({
          apiToken: cloudflareApiToken.value(),
          zoneId: cloudflareZoneId.value(),
          baseDomain: cloudflareBaseDomain.value(),
          accountId: cloudflareAccountId.value(),
        });

        const workerScript = "financely-sites-worker";

        // Delete custom hostname
        try {
          await cloudflareService.deleteCustomHostname(cleanDomain, workerScript);
          logger.info("Cloudflare custom hostname deleted", {
            domain: cleanDomain,
            worker: workerScript,
          });
        } catch (hostnameError) {
          logger.warn("Failed to delete Cloudflare custom hostname (may not exist)", {
            domain: cleanDomain,
            error: hostnameError instanceof Error ? hostnameError.message : "Unknown error",
          });
          // Continue with route deletion even if hostname deletion fails
        }

        // Delete Worker route
        try {
          const routePattern = `${cleanDomain}/*`;
          await cloudflareService.deleteWorkerRoute(routePattern);
          logger.info("Cloudflare Workers route deleted", {
            domain: cleanDomain,
            pattern: routePattern,
          });
        } catch (routeError) {
          logger.warn("Failed to delete Cloudflare Workers route (may not exist)", {
            domain: cleanDomain,
            error: routeError instanceof Error ? routeError.message : "Unknown error",
          });
          // Continue with removal even if route deletion fails
        }

        // Try to remove DNS record if domain is in Cloudflare

        try {
          // Try to find and delete DNS records for this domain
          await cloudflareService.deleteAllDnsRecords(cleanDomain, ["CNAME", "A", "AAAA"]);
          logger.info("DNS records removed from Cloudflare", {
            domain: cleanDomain,
          });
        } catch (dnsError) {
          logger.warn("Failed to remove DNS records (domain may not be in Cloudflare)", {
            domain: cleanDomain,
            error: dnsError instanceof Error ? dnsError.message : "Unknown error",
          });
          // Continue with removal even if DNS deletion fails
        }
      } else {
        // Remove from Firebase Hosting
        const hostingService = new FirebaseHostingService({
          projectId: firebaseProjectId.value(),
        });

        try {
          await hostingService.deleteCustomDomain(siteId, cleanDomain);
          logger.info("Custom domain removed from Firebase Hosting", {
            brandSiteId,
            domain: cleanDomain,
          });
        } catch (hostingError) {
          const errorMessage = hostingError instanceof Error ? hostingError.message : "Unknown error";
          logger.error("Failed to remove domain from Firebase Hosting", {
            brandSiteId,
            domain: cleanDomain,
            error: errorMessage,
          });
          // Continue with database update even if Firebase Hosting removal fails
          // The domain may have already been removed or never existed
        }
      }

      // Update brand site to remove custom domain
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          customDomain: undefined, // Remove the custom domain
        },
      });

      logger.info("Custom domain removed successfully", {
        brandSiteId,
        customDomain: cleanDomain,
        hostingProvider,
      });

      return {
        success: true,
        message: "Custom domain removed successfully",
      };
    } catch (error) {
      logger.error("Error removing custom domain", {
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
          : "Failed to remove custom domain",
      );
    }
  },
);

