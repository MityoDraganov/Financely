import { DatabaseService, MarketplaceTemplate, MarketplaceTemplateData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { MarketplaceTemplateRepository } from "@/core/ports/repositories/marketplace-template-repository";

/**
 * Factory for a `MarketplaceTemplateRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {MarketplaceTemplateRepository} Repository with CRUD operations for marketplace templates.
 */
export function getMarketplaceTemplateRepository(
  databaseService: DatabaseService,
): MarketplaceTemplateRepository {
  return getGenericRepository<MarketplaceTemplate, MarketplaceTemplateData>(
    () => DatabaseCollection.MARKETPLACE_TEMPLATES,
    databaseService,
  );
}
