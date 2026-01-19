import { MarketplaceTemplate, MarketplaceTemplateData } from "../../entities/marketplace-template";
import { GenericRepository } from "./generic-repository";

export type MarketplaceTemplateRepository = GenericRepository<MarketplaceTemplate, MarketplaceTemplateData>;
