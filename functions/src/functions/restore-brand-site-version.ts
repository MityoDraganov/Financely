import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface RestoreVersionPayload {
  brandSiteId: string;
  version: number;
}

/**
 * Firebase Cloud Function for restoring a previous version of a brand site.
 *
 * This function restores the HTML, deployedUrl, and metadata from a previous version
 * and saves the current version to history before restoring.
 *
 * Request payload:
 * {
 *   brandSiteId: string,
 *   version: number
 * }
 *
 * Response: { success: boolean; brandSiteId: string; restoredVersion: number }
 */
export const restoreBrandSiteVersion = onCall<RestoreVersionPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [firebaseProjectId],
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditBrandSiteId: string | undefined;
    let auditBrandSiteName: string | undefined;
    try {
      const { brandSiteId, version } = request.data;
      auditBrandSiteId = brandSiteId;

      if (!brandSiteId) {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      if (!version || typeof version !== "number") {
        throw new HttpsError("invalid-argument", "version is required and must be a number");
      }

      logger.info("Restoring brand site version", {
        brandSiteId,
        version,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }
      auditOrganizationId = brandSite.organizationId;
      auditBrandSiteName = brandSite.brandName;

      // Find the version to restore
      const existingVersions = brandSite.versions || [];
      const versionToRestore = existingVersions.find((v) => v.version === version);

      if (!versionToRestore) {
        throw new HttpsError(
          "not-found",
          `Version ${version} not found in version history`,
        );
      }

      // Save current version to history before restoring (if there's existing HTML)
      const currentVersions = [...existingVersions];
      if (brandSite.html) {
        currentVersions.push({
          version: brandSite.metadata?.version || 1,
          html: brandSite.html,
          deployedUrl: brandSite.deployedUrl,
          metadata: brandSite.metadata,
          createdAt: brandSite.metadata?.generatedAt || new Date().toISOString(),
          description: "Version before restore",
        });
      }

      // Validate restored HTML is not empty
      if (!versionToRestore.html || versionToRestore.html.trim().length === 0) {
        throw new HttpsError(
          "failed-precondition",
          `Version ${version} contains empty HTML and cannot be restored`,
        );
      }

      // Restore the HTML in Firestore first
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          html: versionToRestore.html,
          metadata: {
            ...versionToRestore.metadata,
            version: versionToRestore.version,
          },
          versions: currentVersions,
          status: "deploying", // Set to deploying while we redeploy
        },
      });

      // Redeploy the restored HTML to Firebase Hosting
      let deployedUrl: string;
      try {
        const hostingService = new FirebaseHostingService({
          projectId: firebaseProjectId.value(),
        });

        // Generate site ID from brandSiteId (same format as in handleGenerateSite)
        const siteId = `brand-${brandSiteId}`;

        // Deploy the restored HTML
        logger.info("Redeploying restored version to Firebase Hosting", {
          brandSiteId,
          siteId,
          version,
          htmlLength: versionToRestore.html.length,
        });

        deployedUrl = await hostingService.deploySite(
          siteId,
          [{ path: "index.html", contents: versionToRestore.html }],
          `Restore version ${version}`,
        );

        logger.info("Restored version redeployed successfully", {
          brandSiteId,
          deployedUrl,
        });

        // Update with the deployed URL and success status
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            deployedUrl,
            status: "success",
          },
        });
      } catch (deployError) {
        const error = deployError instanceof Error ? deployError.message : "Unknown deployment error";
        logger.error("Failed to redeploy restored version", {
          brandSiteId,
          version,
          error,
        });

        // Update status to failed but keep the restored HTML
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            status: "failed",
            error: `Failed to redeploy: ${error}`,
          },
        });

        throw new HttpsError(
          "internal",
          `Failed to redeploy restored version: ${error}`,
        );
      }

      logger.info("Brand site version restored and redeployed successfully", {
        brandSiteId,
        restoredVersion: version,
        deployedUrl,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "restoreBrandSiteVersion",
        organizationId: brandSite.organizationId,
        action: "site.version.restored",
        resource: {
          type: "site",
          id: brandSiteId,
          name: brandSite.brandName,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "restoreBrandSiteVersion",
          customFields: {
            restoredVersion: version,
            deployedUrl,
          },
        },
      });

      return {
        success: true,
        brandSiteId,
        restoredVersion: version,
      };
    } catch (error) {
      logger.error("Error restoring brand site version", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      const errorPayload = request.data as RestoreVersionPayload;
      let organizationId = auditOrganizationId;
      let resourceName = auditBrandSiteName;

      if (!organizationId && errorPayload?.brandSiteId) {
        const databaseService = getDatabaseService();
        const brandSiteRepository = getBrandSiteRepository(databaseService);
        const brandSite = await brandSiteRepository.get({ id: errorPayload.brandSiteId });
        organizationId = brandSite?.organizationId;
        resourceName = brandSite?.brandName;
      }

      await logAuditFailureForRequest({
        request,
        operationName: "restoreBrandSiteVersion",
        organizationId,
        action: "site.version.restored",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: errorPayload?.brandSiteId
          ? {
              type: "site",
              id: errorPayload.brandSiteId,
              name: resourceName,
            }
          : auditBrandSiteId
            ? {
                type: "site",
                id: auditBrandSiteId,
                name: auditBrandSiteName,
              }
            : undefined,
        metadata: {
          source: "api",
          sourceDetails: "restoreBrandSiteVersion",
          customFields: {
            requestedVersion: errorPayload?.version,
          },
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to restore version",
      );
    }
  },
);
