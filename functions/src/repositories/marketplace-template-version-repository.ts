import { DatabaseService } from "../core";
import { MarketplaceTemplateVersion, MarketplaceTemplateVersionData } from "../core/entities/marketplace-template";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "../core/ports/repositories/generic-repository";

export function getMarketplaceTemplateVersionRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceTemplateVersion, MarketplaceTemplateVersionData> {
  return getGenericRepository<MarketplaceTemplateVersion, MarketplaceTemplateVersionData>(
    () => DatabaseCollection.MARKETPLACE_TEMPLATE_VERSIONS,
    databaseService,
  );
}
