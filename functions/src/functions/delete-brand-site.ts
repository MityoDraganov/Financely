import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { BrandSiteStorageService } from "../services/brand-site-storage-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { CloudflareService } from "../services/cloudflare-service";
import { loggerService } from "../services/logger-service";

const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");

interface DeleteBrandSitePayload {
  brandSiteId: string;
}

/**
 * Firebase Cloud Function to delete a brand site and all its associated data.
 * 
 * This function:
 * - Deletes the brand site document from Firestore
 * - Deletes all associated files from Cloud Storage
 * - Removes the Firebase Hosting site
 * - Deletes Cloudflare DNS records (CNAME and A records) for the subdomain
 * - Does NOT affect widgets (they are stored separately in organization settings)
 * 
 * Request payload:
 * {
 *   brandSiteId: string
 * }
 * 
 * Response: { success: true, brandSiteId: string }
 */
export const deleteBrandSite = onCall<DeleteBrandSitePayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    secrets: [cloudflareApiToken, cloudflareZoneId, cloudflareBaseDomain],
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { brandSiteId } = request.data;

      if (!brandSiteId) {
        throw new HttpsError(
          "invalid-argument",
          "brandSiteId is required",
        );
      }

      loggerService.info("Deleting brand site", {
        brandSiteId,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);
      const storageService = new BrandSiteStorageService();

      // Get brand site to verify it exists
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError(
          "not-found",
          "Brand site not found",
        );
      }

      // TODO: Add authentication check to verify user owns the organization
      // const userContext = await extractUserContextFromRequest(request);
      // if (userContext?.organizationId !== brandSite.organizationId) {
      //   throw new HttpsError("permission-denied", "Access denied");
      // }

      // Delete all files from Cloud Storage
      try {
        await storageService.deleteAll(brandSiteId);
        loggerService.info("Deleted brand site files from Cloud Storage", { brandSiteId });
      } catch (storageError) {
        loggerService.warn("Failed to delete some files from Cloud Storage (continuing)", {
          brandSiteId,
          error: storageError instanceof Error ? storageError.message : "Unknown error",
        });
        // Continue with deletion even if storage cleanup fails
      }

      // Delete Cloudflare DNS records if subdomain exists
      if (brandSite.subdomain) {
        try {
          const cloudflareService = new CloudflareService({
            apiToken: cloudflareApiToken.value(),
            zoneId: cloudflareZoneId.value(),
            baseDomain: cloudflareBaseDomain.value(),
          });

          const fullSubdomain = `${brandSite.subdomain}.${cloudflareBaseDomain.value()}`;
          
          try {
            // Find DNS records for this subdomain
            const records = await cloudflareService.listDnsRecords(fullSubdomain, "CNAME");
            
            // Also check for A records (in case there are any)
            const aRecords = await cloudflareService.listDnsRecords(fullSubdomain, "A");
            const allRecords = [...records, ...aRecords];

            if (allRecords.length > 0) {
              // Delete all found records
              for (const record of allRecords) {
                try {
                  await cloudflareService.deleteDnsRecord(record.id);
                  loggerService.info("Deleted Cloudflare DNS record", {
                    brandSiteId,
                    subdomain: fullSubdomain,
                    recordId: record.id,
                    recordType: record.type,
                  });
                } catch (deleteError) {
                  loggerService.warn("Failed to delete Cloudflare DNS record (continuing)", {
                    brandSiteId,
                    subdomain: fullSubdomain,
                    recordId: record.id,
                    error: deleteError instanceof Error ? deleteError.message : "Unknown error",
                  });
                }
              }
            } else {
              loggerService.info("No Cloudflare DNS records found for subdomain", {
                brandSiteId,
                subdomain: fullSubdomain,
              });
            }
          } catch (cloudflareError) {
            loggerService.warn("Failed to delete Cloudflare DNS records (continuing)", {
              brandSiteId,
              subdomain: brandSite.subdomain,
              error: cloudflareError instanceof Error ? cloudflareError.message : "Unknown error",
            });
            // Continue with deletion even if Cloudflare cleanup fails
          }
        } catch (cloudflareInitError) {
          loggerService.warn("Failed to initialize Cloudflare service (continuing)", {
            brandSiteId,
            error: cloudflareInitError instanceof Error ? cloudflareInitError.message : "Unknown error",
          });
          // Continue with deletion even if Cloudflare initialization fails
        }
      }

      // Delete Firebase Hosting site if it exists
      try {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (projectId) {
          const hostingService = new FirebaseHostingService({ projectId });
          const siteId = `brand-${brandSiteId}`;
          
          try {
            await hostingService.deleteSite(siteId);
            loggerService.info("Deleted Firebase Hosting site", { brandSiteId, siteId });
          } catch (hostingError: any) {
            // Site might not exist, which is fine
            if (hostingError?.code !== 404 && hostingError?.status !== 404) {
              loggerService.warn("Failed to delete Firebase Hosting site (continuing)", {
                brandSiteId,
                siteId,
                error: hostingError instanceof Error ? hostingError.message : "Unknown error",
              });
            }
          }
        }
      } catch (hostingError) {
        loggerService.warn("Failed to delete Firebase Hosting site (continuing)", {
          brandSiteId,
          error: hostingError instanceof Error ? hostingError.message : "Unknown error",
        });
        // Continue with deletion even if hosting cleanup fails
      }

      // Delete the brand site document from Firestore
      await brandSiteRepository.delete({ id: brandSiteId });

      const duration = Date.now() - startTime;
      loggerService.info("Brand site deleted successfully", {
        brandSiteId,
        duration,
      });

      return { success: true, brandSiteId };
    } catch (error) {
      const duration = Date.now() - startTime;
      loggerService.error("Failed to delete brand site", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
        duration,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to delete brand site",
      );
    }
  }
);

