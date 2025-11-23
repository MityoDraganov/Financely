import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { loggerService } from "../services/logger-service";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface CleanupPreviewSitesPayload {
  dryRun?: boolean; // If true, only list sites without deleting
  brandSiteId?: string; // If provided, only clean up preview sites for this brand site
}

/**
 * Firebase Cloud Function to clean up orphaned preview sites.
 * 
 * Preview sites are created for version previews but are never automatically deleted.
 * This function finds and deletes all preview sites (or preview sites for a specific brand site).
 * 
 * Request payload:
 * {
 *   dryRun?: boolean,      // If true, only list sites without deleting (default: false)
 *   brandSiteId?: string   // If provided, only clean up preview sites for this brand site
 * }
 * 
 * Response: { 
 *   success: boolean,
 *   deletedCount: number,
 *   deletedSites: string[],
 *   totalPreviewSites: number
 * }
 */
export const cleanupPreviewSites = onCall<CleanupPreviewSitesPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300, // 5 minutes for cleanup
    secrets: [firebaseProjectId],
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { dryRun = false, brandSiteId } = request.data;

      loggerService.info("Starting preview sites cleanup", {
        dryRun,
        brandSiteId: brandSiteId || "all",
      });

      const projectId = firebaseProjectId.value();
      if (!projectId) {
        throw new HttpsError(
          "failed-precondition",
          "FIREBASE_PROJECT_ID secret is not configured",
        );
      }

      const hostingService = new FirebaseHostingService({ projectId });

      // List all sites
      const allSites = await hostingService.listAllSites();
      loggerService.info("Listed all Firebase Hosting sites", {
        totalSites: allSites.length,
      });

      // Filter preview sites
      let previewSites = allSites.filter((site) =>
        site.siteId?.includes("-preview-")
      );

      // If brandSiteId is provided, filter to only that brand's preview sites
      if (brandSiteId) {
        const siteIdPrefix = `brand-${brandSiteId}-preview-`;
        previewSites = previewSites.filter((site) =>
          site.siteId?.startsWith(siteIdPrefix)
        );
      }

      loggerService.info("Found preview sites", {
        count: previewSites.length,
        previewSiteIds: previewSites.map((s) => s.siteId),
      });

      if (previewSites.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          deletedSites: [],
          totalPreviewSites: 0,
          message: "No preview sites found to clean up",
        };
      }

      if (dryRun) {
        return {
          success: true,
          deletedCount: 0,
          deletedSites: [],
          totalPreviewSites: previewSites.length,
          previewSites: previewSites.map((s) => ({
            siteId: s.siteId,
            defaultUrl: s.defaultUrl,
          })),
          message: `DRY RUN: Found ${previewSites.length} preview sites that would be deleted`,
        };
      }

      // Delete preview sites
      const deletedSites: string[] = [];
      const failedSites: Array<{ siteId: string; error: string }> = [];

      for (const previewSite of previewSites) {
        if (!previewSite.siteId) {
          continue;
        }

        try {
          await hostingService.deleteSite(previewSite.siteId);
          deletedSites.push(previewSite.siteId);
          loggerService.info("Deleted preview site", {
            siteId: previewSite.siteId,
          });
        } catch (deleteError: any) {
          // 404 means site doesn't exist (already deleted), which is fine
          if (deleteError?.code === 404 || deleteError?.status === 404) {
            deletedSites.push(previewSite.siteId); // Count as deleted
            loggerService.info("Preview site already deleted", {
              siteId: previewSite.siteId,
            });
          } else {
            const errorMessage =
              deleteError instanceof Error
                ? deleteError.message
                : "Unknown error";
            failedSites.push({
              siteId: previewSite.siteId,
              error: errorMessage,
            });
            loggerService.error("Failed to delete preview site", {
              siteId: previewSite.siteId,
              error: errorMessage,
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      loggerService.info("Preview sites cleanup completed", {
        totalPreviewSites: previewSites.length,
        deletedCount: deletedSites.length,
        failedCount: failedSites.length,
        duration,
      });

      return {
        success: true,
        deletedCount: deletedSites.length,
        deletedSites,
        totalPreviewSites: previewSites.length,
        failedSites: failedSites.length > 0 ? failedSites : undefined,
        message:
          failedSites.length > 0
            ? `Deleted ${deletedSites.length} of ${previewSites.length} preview sites. ${failedSites.length} failed.`
            : `Successfully deleted ${deletedSites.length} preview sites.`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      loggerService.error("Failed to cleanup preview sites", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
        duration,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to cleanup preview sites",
      );
    }
  }
);

