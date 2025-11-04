import { DatabaseService } from "../core";
import { BrandSite, BrandSiteData } from "../core/entities/brand-site";
import { BrandSiteRepository } from "../core/ports/repositories/brand-site-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `BrandSiteRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {BrandSiteRepository} Repository with CRUD operations for brand sites.
 */
export function getBrandSiteRepository(
  databaseService: DatabaseService,
): BrandSiteRepository {
  return getGenericRepository<BrandSite, BrandSiteData>(
    () => DatabaseCollection.BRAND_SITES,
    databaseService,
  );
}

