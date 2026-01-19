import { DatabaseService } from "../core";
import { MarketplaceTemplate } from "../core/entities/marketplace-template";
import { MarketplaceReview } from "../core/entities/marketplace-review";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { getMarketplaceReviewRepository } from "../repositories/marketplace-review-repository";
import { loggerService } from "./logger-service";

export interface MarketplaceTemplateService {
  /**
   * List marketplace templates with filters
   */
  listTemplates(params: {
    type?: "invoice" | "email";
    search?: string;
    category?: string;
    language?: string;
    sort?: "popular" | "newest" | "rating";
    page?: number;
    limit?: number;
    databaseService: DatabaseService;
  }): Promise<{ templates: MarketplaceTemplate[]; total: number }>;

  /**
   * Get a single marketplace template
   */
  getTemplate(
    templateId: string,
    databaseService: DatabaseService
  ): Promise<MarketplaceTemplate | null>;

  /**
   * Update template rating after a review is submitted
   */
  updateTemplateRating(
    templateId: string,
    databaseService: DatabaseService
  ): Promise<void>;

  /**
   * Increment download count
   */
  incrementDownloadCount(
    templateId: string,
    databaseService: DatabaseService
  ): Promise<void>;
}

export const marketplaceTemplateService: MarketplaceTemplateService = {
  async listTemplates(params) {
    const {
      type,
      search,
      category,
      language,
      sort = "popular",
      limit = 20,
      databaseService,
    } = params;

    const templateRepo = getMarketplaceTemplateRepository(databaseService);
    const queryConstraints: Array<{
      field: string;
      operator: "==" | ">=" | "<=" | ">" | "<" | "array-contains";
      value: any;
    }> = [];

    // Only show published templates
    queryConstraints.push({
      field: "status",
      operator: "==",
      value: "published",
    });

    if (type) {
      queryConstraints.push({ field: "type", operator: "==", value: type });
    }

    if (category) {
      queryConstraints.push({
        field: "category",
        operator: "==",
        value: category,
      });
    }

    if (language) {
      queryConstraints.push({
        field: "language",
        operator: "==",
        value: language,
      });
    }

    // Determine order by based on sort
    let orderBy: { field: string; direction: "asc" | "desc" } | undefined;
    if (sort === "popular") {
      orderBy = { field: "downloadCount", direction: "desc" };
    } else if (sort === "newest") {
      orderBy = { field: "publishedAt", direction: "desc" };
    } else if (sort === "rating") {
      orderBy = { field: "ratingAverage", direction: "desc" };
    }

    const result = await templateRepo.getAll({
      queryConstraints,
      pagination: {
        limit,
      },
      orderBy,
    });

    let templates = result;

    // Apply search filter if provided (client-side filtering for now)
    // In production, consider using Algolia or similar for better search
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(
        (template: MarketplaceTemplate) =>
          template.title.toLowerCase().includes(searchLower) ||
          template.description?.toLowerCase().includes(searchLower) ||
          template.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }

    return {
      templates,
      total: result.length,
    };
  },

  async getTemplate(templateId: string, databaseService: DatabaseService) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);
    try {
      return await templateRepo.get({ id: templateId });
    } catch (error) {
      loggerService.error("Error getting marketplace template", {
        templateId,
        error,
      });
      return null;
    }
  },

  async updateTemplateRating(templateId: string, databaseService: DatabaseService) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);
    const reviewRepo = getMarketplaceReviewRepository(databaseService);

    // Get all approved reviews for this template
    const reviews = await reviewRepo.getAll({
      queryConstraints: [
        { field: "templateId", operator: "==", value: templateId },
        { field: "status", operator: "==", value: "approved" },
      ],
    });

    if (reviews.length === 0) {
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce(
      (sum: number, review: MarketplaceReview) => sum + review.rating,
      0
    );
    const averageRating = totalRating / reviews.length;

    // Update template
    const template = await templateRepo.get({ id: templateId });
    if (template) {
      await templateRepo.update({
        id: templateId,
        data: {
          ratingAverage: Math.round(averageRating * 10) / 10, // Round to 1 decimal
          ratingCount: reviews.length,
        },
      });
    }
  },

  async incrementDownloadCount(templateId: string, databaseService: DatabaseService) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);
    const template = await templateRepo.get({ id: templateId });

    if (template) {
      await templateRepo.update({
        id: templateId,
        data: {
          downloadCount: (template.downloadCount || 0) + 1,
        },
      });
    }
  },
};
