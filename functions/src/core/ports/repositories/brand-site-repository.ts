import { BrandSite, BrandSiteData } from "../../entities/brand-site";
import { GenericRepository } from "./generic-repository";

export type BrandSiteRepository = GenericRepository<
  BrandSite,
  BrandSiteData,
  { organizationId?: string }
>;

