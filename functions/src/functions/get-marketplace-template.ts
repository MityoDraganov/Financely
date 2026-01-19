import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAuth } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { marketplaceTemplateService } from "../services/marketplace-template-service";
import { loggerService } from "../services/logger-service";

interface GetMarketplaceTemplateInput {
  templateId: string;
}

interface GetMarketplaceTemplateResponse {
  id: string;
  title: string;
  description?: string;
  shortDescription?: string;
  type: "invoice" | "email";
  authorId: string;
  authorName: string;
  isOfficial: boolean;
  previewImages: string[];
  tags: string[];
  category?: string;
  language?: string;
  country?: string;
  ratingAverage: number;
  ratingCount: number;
  downloadCount: number;
  version: number;
  publishedAt?: string;
  // Template content preview (simplified, not full content)
  templateContentPreview?: {
    type: "invoice" | "email";
    name: string;
    description?: string;
  };
}

/**
 * Get a single marketplace template by ID
 * Requires authentication
 */
export const getMarketplaceTemplate = onCall<
  GetMarketplaceTemplateInput,
  Promise<GetMarketplaceTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      await verifyAuth(request);

      const { templateId } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      const databaseService = getDatabaseService();
      const template = await marketplaceTemplateService.getTemplate(
        templateId,
        databaseService
      );

      if (!template) {
        throw new HttpsError("not-found", "Template not found");
      }

      // Return template data with simplified content preview
      return {
        id: template.id,
        title: template.title,
        description: template.description,
        shortDescription: template.shortDescription,
        type: template.type,
        authorId: template.authorId,
        authorName: template.authorName,
        isOfficial: template.isOfficial,
        previewImages: template.previewImages,
        tags: template.tags,
        category: template.category,
        language: template.language,
        country: template.country,
        ratingAverage: template.ratingAverage,
        ratingCount: template.ratingCount,
        downloadCount: template.downloadCount,
        version: template.version,
        publishedAt: template.publishedAt,
        templateContentPreview: {
          type: template.type,
          name:
            template.type === "invoice"
              ? (template.templateContent as any)?.name || template.title
              : (template.templateContent as any)?.name || template.title,
          description:
            template.type === "invoice"
              ? (template.templateContent as any)?.description
              : (template.templateContent as any)?.description,
        },
      };
    } catch (error) {
      loggerService.error("Error getting marketplace template", {
        templateId: request.data?.templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to get marketplace template"
      );
    }
  }
);
