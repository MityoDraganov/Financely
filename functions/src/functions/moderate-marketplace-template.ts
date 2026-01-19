import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminAuth } from "../utils/admin-auth-utils";
import { getDatabaseService } from "../services/database-service";
import { marketplaceModerationService } from "../services/marketplace-moderation-service";
import { loggerService } from "../services/logger-service";

interface FeatureTemplateInput {
  templateId: string;
}

interface ModerateTemplateResponse {
  success: boolean;
  message: string;
}

/**
 * Feature a marketplace template (admin only)
 * Featured templates appear first in marketplace listings
 */
export const featureMarketplaceTemplate = onCall<
  FeatureTemplateInput,
  Promise<ModerateTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify admin authentication
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "marketplace.moderate",
      });

      const { templateId } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      const databaseService = getDatabaseService();

      await marketplaceModerationService.featureTemplate(
        templateId,
        adminAuth.userId,
        databaseService
      );

      return {
        success: true,
        message: "Template featured successfully",
      };
    } catch (error) {
      loggerService.error("Error featuring marketplace template", {
        templateId: request.data?.templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to feature marketplace template"
      );
    }
  }
);

/**
 * Unfeature a marketplace template (admin only)
 */
export const unfeatureMarketplaceTemplate = onCall<
  FeatureTemplateInput,
  Promise<ModerateTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify admin authentication
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "marketplace.moderate",
      });

      const { templateId } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      const databaseService = getDatabaseService();

      await marketplaceModerationService.unfeatureTemplate(
        templateId,
        adminAuth.userId,
        databaseService
      );

      return {
        success: true,
        message: "Template unfeatured successfully",
      };
    } catch (error) {
      loggerService.error("Error unfeaturing marketplace template", {
        templateId: request.data?.templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to unfeature marketplace template"
      );
    }
  }
);
