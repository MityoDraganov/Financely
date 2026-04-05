import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { getDatabaseService } from "../../services/database-service";
import { marketplaceTemplateService } from "../../services/marketplace-template-service";
import { templateImportService } from "../../services/template-import-service";
import { loggerService } from "../../services/logger-service";

interface AdminAddMarketplaceTemplateInput {
  templateId: string;
  orgId: string;
}

interface AdminAddMarketplaceTemplateResponse {
  success: boolean;
  templateId: string;
  name: string;
  renamed: boolean;
  message: string;
}

/**
 * Admin-only template import for marketplace moderation/designer workflows.
 * Unlike the public addMarketplaceTemplate function, this does not require the
 * caller to be a member of the target organization.
 */
export const adminAddMarketplaceTemplate = onCall<
  AdminAddMarketplaceTemplateInput,
  Promise<AdminAddMarketplaceTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { templateId, orgId } = request.data;

      if (!templateId) {
        throw new HttpsError("invalid-argument", "Template ID is required");
      }

      if (!orgId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "marketplace.moderate",
      });

      const db = getFirestore();
      const organizationDoc = await db.collection("organizations").doc(orgId).get();
      if (!organizationDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }
      const organizationData = organizationDoc.data();
      if (!organizationData || organizationData.status !== "active") {
        throw new HttpsError("failed-precondition", "Organization is not active");
      }

      const databaseService = getDatabaseService();
      const marketplaceTemplate = await marketplaceTemplateService.getTemplate(
        templateId,
        databaseService,
      );

      if (!marketplaceTemplate) {
        throw new HttpsError("not-found", "Marketplace template not found");
      }

      if (marketplaceTemplate.status !== "published") {
        throw new HttpsError(
          "failed-precondition",
          "Template is not available for download",
        );
      }

      const result = await templateImportService.importTemplate(
        marketplaceTemplate,
        orgId,
        databaseService,
      );

      await marketplaceTemplateService.incrementDownloadCount(
        templateId,
        databaseService,
      );

      loggerService.info("Admin imported marketplace template", {
        templateId,
        orgId,
        importedTemplateId: result.id,
        adminUserId: adminAuth.userId,
      });

      return {
        success: true,
        templateId: result.id,
        name: result.name,
        renamed: result.renamed,
        message: result.renamed
          ? `Template "${result.name}" was imported with a renamed title.`
          : `Template "${result.name}" imported successfully.`,
      };
    } catch (error) {
      loggerService.error("Error importing marketplace template as admin", {
        templateId: request.data?.templateId,
        orgId: request.data?.orgId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to add marketplace template");
    }
  },
);

