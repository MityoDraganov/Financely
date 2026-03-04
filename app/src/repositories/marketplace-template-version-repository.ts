import { DatabaseService, MarketplaceTemplateVersion, MarketplaceTemplateVersionData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "@/core/ports/repositories/generic-repository";

export function getMarketplaceTemplateVersionRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceTemplateVersion, MarketplaceTemplateVersionData> {
  return getGenericRepository<MarketplaceTemplateVersion, MarketplaceTemplateVersionData>(
    () => DatabaseCollection.MARKETPLACE_TEMPLATE_VERSIONS,
    databaseService,
  );
}
