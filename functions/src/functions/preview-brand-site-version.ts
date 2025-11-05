import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface PreviewVersionPayload {
  brandSiteId: string;
  version: number;
}

/**
 * Firebase Cloud Function for previewing a previous version of a brand site.
 * Deploys the version to a preview channel and returns the preview URL.
 *
 * Request payload:
 * {
 *   brandSiteId: string,
 *   version: number
 * }
 *
 * Response: { success: boolean; brandSiteId: string; version: number; previewUrl: string }
 */
export const previewBrandSiteVersion = onCall<PreviewVersionPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [firebaseProjectId],
  },
  async (request) => {
    try {
      const { brandSiteId, version } = request.data;

      if (!brandSiteId) {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      if (!version || typeof version !== "number") {
        throw new HttpsError("invalid-argument", "version is required and must be a number");
      }

      logger.info("Creating preview for brand site version", {
        brandSiteId,
        version,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      // Find the version to preview
      const existingVersions = brandSite.versions || [];
      const versionToPreview = existingVersions.find((v) => v.version === version);

      if (!versionToPreview) {
        throw new HttpsError(
          "not-found",
          `Version ${version} not found in version history`,
        );
      }

      // Validate HTML is not empty
      if (!versionToPreview.html || versionToPreview.html.trim().length === 0) {
        throw new HttpsError(
          "failed-precondition",
          `Version ${version} contains empty HTML and cannot be previewed`,
        );
      }

      // Check if preview URL already exists
      if (versionToPreview.previewUrl) {
        logger.info("Preview URL already exists for version", {
          brandSiteId,
          version,
          previewUrl: versionToPreview.previewUrl,
        });
        return {
          success: true,
          brandSiteId,
          version,
          previewUrl: versionToPreview.previewUrl,
        };
      }

      // Deploy to preview channel
      const hostingService = new FirebaseHostingService({
        projectId: firebaseProjectId.value(),
      });

      const siteId = `brand-${brandSiteId}`;
      const channelId = `v${version}-${brandSiteId.substring(0, 8)}`;

      logger.info("Deploying version to preview channel", {
        brandSiteId,
        siteId,
        channelId,
        version,
        htmlLength: versionToPreview.html.length,
      });

      const previewUrl = await hostingService.deployToPreviewChannel(
        siteId,
        [{ path: "index.html", contents: versionToPreview.html }],
        channelId,
        `Preview version ${version}`,
      );

      // Update the version with the preview URL
      const updatedVersions = existingVersions.map((v) =>
        v.version === version ? { ...v, previewUrl } : v
      );

      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          versions: updatedVersions,
        },
      });

      logger.info("Version preview created successfully", {
        brandSiteId,
        version,
        previewUrl,
      });

      return {
        success: true,
        brandSiteId,
        version,
        previewUrl,
      };
    } catch (error) {
      logger.error("Error creating version preview", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to create preview",
      );
    }
  },
);

