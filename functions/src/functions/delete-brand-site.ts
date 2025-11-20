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
      // This MUST succeed - DNS cleanup failure is a hard error that prevents site deletion
      // We cannot leave orphaned DNS records that will cause "already exists" errors on next create
      if (brandSite.subdomain) {
        const fullSubdomain = `${brandSite.subdomain}.${cloudflareBaseDomain.value()}`;
        
        // Log cleanup parameters for debugging
        loggerService.info("Cloudflare cleanup parameters", {
          brandSiteId,
          subdomain: brandSite.subdomain,
          fullSubdomain,
          baseDomain: cloudflareBaseDomain.value(),
          zoneId: cloudflareZoneId.value(),
        });

          const cloudflareService = new CloudflareService({
            apiToken: cloudflareApiToken.value(),
            zoneId: cloudflareZoneId.value(),
            baseDomain: cloudflareBaseDomain.value(),
          });

        loggerService.info("Deleting all Cloudflare DNS records for subdomain", {
                    brandSiteId,
                    subdomain: fullSubdomain,
        });

        // Use the robust deletion method that handles all record types, retries, and verification
        // This will throw if records cannot be deleted after all retries
        // We delete CNAME, A, and AAAA records (all types we might create)
        await cloudflareService.deleteAllDnsRecords(fullSubdomain, ["CNAME", "A", "AAAA"]);

        // Final verification: check one more time to ensure absolutely nothing remains
        const allRecords = await cloudflareService.listDnsRecords();
        const remainingRecords = allRecords.filter(
          (record) => record.name.toLowerCase() === fullSubdomain.toLowerCase(),
        );

        if (remainingRecords.length > 0) {
          // This should not happen if deleteAllDnsRecords worked correctly
          // But we check anyway to be absolutely sure
          loggerService.error("CRITICAL: DNS records still exist after deletion", {
                    brandSiteId,
                    subdomain: fullSubdomain,
            remainingRecords: remainingRecords.map((r) => ({
              id: r.id,
              type: r.type,
              name: r.name,
            })),
          });
          throw new HttpsError(
            "internal",
            `Failed to delete all Cloudflare DNS records. Remaining records: ${remainingRecords.map((r) => `${r.type}:${r.name} (${r.id})`).join(", ")}. Site was not fully deleted. Please try again later or contact support.`,
          );
                }

        loggerService.info("Successfully deleted and verified all Cloudflare DNS records", {
                brandSiteId,
                subdomain: fullSubdomain,
              });
      } else {
        // Log warning if subdomain is missing - this could indicate data inconsistency
        loggerService.warn("Brand site has no subdomain - skipping Cloudflare DNS cleanup", {
              brandSiteId,
          hasSubdomain: !!brandSite.subdomain,
              subdomain: brandSite.subdomain,
        });
      }

      // Delete Firebase Hosting site and all preview sites
      try {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (projectId) {
          const hostingService = new FirebaseHostingService({ projectId });
          const siteId = `brand-${brandSiteId}`;
          
          // Delete main site
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

          // Delete all preview sites for this brand site
          // Preview sites follow the pattern: brand-{brandSiteId}-preview-{channelId}
          try {
            const previewSitePattern = `${siteId}-preview-`;
            const allSites = await hostingService.listAllSites();
            const previewSites = allSites.filter((site) =>
              site.siteId?.startsWith(previewSitePattern)
            );

            if (previewSites.length > 0) {
              loggerService.info("Found preview sites to delete", {
                brandSiteId,
                count: previewSites.length,
                previewSiteIds: previewSites.map((s) => s.siteId),
              });

              for (const previewSite of previewSites) {
                if (previewSite.siteId) {
                  try {
                    await hostingService.deleteSite(previewSite.siteId);
                    loggerService.info("Deleted preview site", {
                      brandSiteId,
                      previewSiteId: previewSite.siteId,
                    });
                  } catch (previewError: any) {
                    // Log but continue deleting other preview sites
                    if (previewError?.code !== 404 && previewError?.status !== 404) {
                      loggerService.warn("Failed to delete preview site (continuing)", {
                        brandSiteId,
                        previewSiteId: previewSite.siteId,
                        error: previewError instanceof Error ? previewError.message : "Unknown error",
                      });
                    }
                  }
                }
              }
            }
          } catch (previewListError) {
            loggerService.warn("Failed to list preview sites for cleanup (continuing)", {
              brandSiteId,
              error: previewListError instanceof Error ? previewListError.message : "Unknown error",
            });
            // Continue with deletion even if preview cleanup fails
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

