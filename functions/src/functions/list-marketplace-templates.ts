import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAuth } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { marketplaceTemplateService } from "../services/marketplace-template-service";
import { loggerService } from "../services/logger-service";

interface ListMarketplaceTemplatesInput {
  type?: "invoice" | "email";
  search?: string;
  category?: string;
  language?: string;
  sort?: "popular" | "newest" | "rating";
  page?: number;
  limit?: number;
}

interface ListMarketplaceTemplatesResponse {
  templates: Array<{
    id: string;
    title: string;
    description?: string;
    shortDescription?: string;
    type: "invoice" | "email";
    authorName: string;
    isOfficial: boolean;
    previewImages: string[];
    tags: string[];
    category?: string;
    language?: string;
    ratingAverage: number;
    ratingCount: number;
    downloadCount: number;
    publishedAt?: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * List marketplace templates with filters
 * Requires authentication
 */
export const listMarketplaceTemplates = onCall<
  ListMarketplaceTemplatesInput,
  Promise<ListMarketplaceTemplatesResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      await verifyAuth(request);

      const payload = request.data || {};
      const databaseService = getDatabaseService();

      const result = await marketplaceTemplateService.listTemplates({
        type: payload.type,
        search: payload.search,
        category: payload.category,
        language: payload.language,
        sort: payload.sort || "popular",
        page: payload.page || 1,
        limit: payload.limit || 20,
        databaseService,
      });

      // Return simplified template data (without full content)
      return {
        templates: result.templates.map((template) => ({
          id: template.id,
          title: template.title,
          description: template.description,
          shortDescription: template.shortDescription,
          type: template.type,
          authorName: template.authorName,
          isOfficial: template.isOfficial,
          previewImages: template.previewImages,
          tags: template.tags,
          category: template.category,
          language: template.language,
          ratingAverage: template.ratingAverage,
          ratingCount: template.ratingCount,
          downloadCount: template.downloadCount,
          publishedAt: template.publishedAt,
        })),
        total: result.total,
        page: payload.page || 1,
        limit: payload.limit || 20,
      };
    } catch (error) {
      loggerService.error("Error listing marketplace templates", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to list marketplace templates"
      );
    }
  }
);
