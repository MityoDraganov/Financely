import { DatabaseService, MarketplaceTemplate, MarketplaceTemplateData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "@/core/ports/repositories/generic-repository";

export function getMarketplaceTemplateRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceTemplate, MarketplaceTemplateData> {
  return getGenericRepository<MarketplaceTemplate, MarketplaceTemplateData>(
    () => DatabaseCollection.MARKETPLACE_TEMPLATES,
    databaseService,
  );
}
