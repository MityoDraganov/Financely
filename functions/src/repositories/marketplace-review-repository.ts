import { DatabaseService } from "../core";
import { MarketplaceReview, MarketplaceReviewData } from "../core/entities/marketplace-review";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "../core/ports/repositories/generic-repository";

/**
 * Factory for a `MarketplaceReviewRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {GenericRepository} Repository with CRUD operations for marketplace reviews.
 */
export function getMarketplaceReviewRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceReview, MarketplaceReviewData> {
  return getGenericRepository<MarketplaceReview, MarketplaceReviewData>(
    () => DatabaseCollection.MARKETPLACE_REVIEWS,
    databaseService,
  );
}
