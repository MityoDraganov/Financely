import { DatabaseService } from "../core";
import { MarketplaceTemplate, MarketplaceTemplateData } from "../core/entities/marketplace-template";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "../core/ports/repositories/generic-repository";

/**
 * Factory for a `MarketplaceTemplateRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {GenericRepository} Repository with CRUD operations for marketplace templates.
 */
export function getMarketplaceTemplateRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceTemplate, MarketplaceTemplateData> {
  return getGenericRepository<MarketplaceTemplate, MarketplaceTemplateData>(
    () => DatabaseCollection.MARKETPLACE_TEMPLATES,
    databaseService,
  );
}
