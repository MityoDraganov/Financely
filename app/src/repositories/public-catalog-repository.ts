import { resolvePublicCatalogPage as resolvePublicCatalogPageFromFirestore } from "@/pages/products/public-page/firestore-public-catalog-resolver";
import type { PublicCatalogResponse } from "@/pages/products/public-page/types";

export type ResolvePublicCatalogPageParams = {
  orgSlug: string;
  productSlug?: string;
  collectionSlug?: string;
  cursor?: string;
  locale?: string;
};

export type PublicCatalogRepository = {
  resolvePublicCatalogPage: (
    params: ResolvePublicCatalogPageParams,
  ) => Promise<PublicCatalogResponse>;
};

export function getPublicCatalogRepository(): PublicCatalogRepository {
  return {
    resolvePublicCatalogPage: resolvePublicCatalogPageFromFirestore,
  };
}
