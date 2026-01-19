import { DatabaseService, MarketplaceReview, MarketplaceReviewData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { GenericRepository } from "@/core/ports/repositories/generic-repository";

export function getMarketplaceReviewRepository(
  databaseService: DatabaseService,
): GenericRepository<MarketplaceReview, MarketplaceReviewData> {
  return getGenericRepository<MarketplaceReview, MarketplaceReviewData>(
    () => DatabaseCollection.MARKETPLACE_REVIEWS,
    databaseService,
  );
}
