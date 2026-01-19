import { DatabaseService } from "../core";
import { MarketplaceTemplate } from "../core/entities/marketplace-template";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { loggerService } from "./logger-service";

export interface MarketplaceModerationService {
  /**
   * Feature a marketplace template (admin only)
   */
  featureTemplate(
    templateId: string,
    featuredBy: string,
    databaseService: DatabaseService
  ): Promise<void>;

  /**
   * Unfeature a marketplace template (admin only)
   */
  unfeatureTemplate(
    templateId: string,
    unfeaturedBy: string,
    databaseService: DatabaseService
  ): Promise<void>;

  /**
   * Get all published templates (for admin review/featuring)
   */
  getAllPublishedTemplates(
    databaseService: DatabaseService
  ): Promise<MarketplaceTemplate[]>;
}

export const marketplaceModerationService: MarketplaceModerationService = {
  async featureTemplate(
    templateId: string,
    featuredBy: string,
    databaseService: DatabaseService
  ) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);

    await templateRepo.update({
      id: templateId,
      data: {
        isFeatured: true,
      },
    });

    loggerService.info("Marketplace template featured", {
      templateId,
      featuredBy,
    });
  },

  async unfeatureTemplate(
    templateId: string,
    unfeaturedBy: string,
    databaseService: DatabaseService
  ) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);

    await templateRepo.update({
      id: templateId,
      data: {
        isFeatured: false,
      },
    });

    loggerService.info("Marketplace template unfeatured", {
      templateId,
      unfeaturedBy,
    });
  },

  async getAllPublishedTemplates(databaseService: DatabaseService) {
    const templateRepo = getMarketplaceTemplateRepository(databaseService);

    const result = await templateRepo.getAll({
      queryConstraints: [
        { field: "status", operator: "==", value: "published" },
      ],
      orderBy: { field: "createdAt", direction: "desc" },
    });

    return result;
  },
};
