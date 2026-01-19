import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { marketplaceTemplateService } from "../services/marketplace-template-service";
import { templateImportService } from "../services/template-import-service";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";

interface AddMarketplaceTemplateInput {
  templateId: string;
  orgId: string;
}

interface AddMarketplaceTemplateResponse {
  success: boolean;
  templateId: string;
  name: string;
  renamed: boolean;
  message: string;
}

/**
 * Add a marketplace template to an organization
 * Requires org admin or owner permissions
 */
export const addMarketplaceTemplate = onCall<
  AddMarketplaceTemplateInput,
  Promise<AddMarketplaceTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { templateId, orgId } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      if (!orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID is required"
        );
      }

      // Verify authentication and org membership (requires owner/admin for template management)
      await verifyAuthAndOrgMembership(request, orgId, {
        requireOwnerOrAdmin: true,
      });

      const databaseService = getDatabaseService();

      // Get the marketplace template
      const marketplaceTemplate = await marketplaceTemplateService.getTemplate(
        templateId,
        databaseService
      );

      if (!marketplaceTemplate) {
        throw new HttpsError("not-found", "Marketplace template not found");
      }

      if (marketplaceTemplate.status !== "published") {
        throw new HttpsError(
          "failed-precondition",
          "Template is not available for download"
        );
      }

      // Import the template
      const result = await templateImportService.importTemplate(
        marketplaceTemplate,
        orgId,
        databaseService
      );

      // Increment download count
      await marketplaceTemplateService.incrementDownloadCount(
        templateId,
        databaseService
      );

      // Log audit entry
      const userContext = await extractUserContextFromRequest(request);
      if (userContext) {
        loggerService.info("Marketplace template added to organization", {
          templateId,
          orgId,
          importedTemplateId: result.id,
          userId: userContext.userId,
        });
      }

      return {
        success: true,
        templateId: result.id,
        name: result.name,
        renamed: result.renamed,
        message: result.renamed
          ? `Template "${result.name}" has been added to your organization.`
          : `Template "${result.name}" has been added to your organization.`,
      };
    } catch (error) {
      loggerService.error("Error adding marketplace template", {
        templateId: request.data?.templateId,
        orgId: request.data?.orgId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to add marketplace template"
      );
    }
  }
);
