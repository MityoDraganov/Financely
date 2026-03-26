import { FieldPath } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { Product } from "../../core/entities/product";
import { snapshotToData } from "../../services/database-service";
import {
  resolvePublicCollection,
  slugifySegment,
} from "../../services/public-product-page-service";

type Cursor = {
  createdAt: Date;
  id: string;
};

export type ListingQueryResult = {
  products: Product[];
  hasMore: boolean;
  nextCursor?: string;
};

type GetListingProductsWithFallbackParams = {
  db: FirebaseFirestore.Firestore;
  organizationId: string;
  collectionFilter?: string;
  cursor: Cursor | null;
  pageSize: number;
  buildCursor: (createdAt: unknown, id: string) => string | undefined;
};

const LISTING_FALLBACK_SCAN_BATCH_SIZE = 200;
const LISTING_FALLBACK_SCAN_MAX_DOCS = 4000;

function toIsoDate(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return undefined;
}

function getCreatedAtMillis(value: unknown): number {
  const iso = toIsoDate(value);
  if (!iso) return 0;

  const millis = Date.parse(iso);
  return Number.isFinite(millis) ? millis : 0;
}

function compareProductsForListing(a: Product, b: Product): number {
  const aCreatedAt = getCreatedAtMillis(a.createdAt);
  const bCreatedAt = getCreatedAtMillis(b.createdAt);
  if (aCreatedAt !== bCreatedAt) {
    return bCreatedAt - aCreatedAt;
  }
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function isProductAfterCursor(product: Product, cursor: Cursor): boolean {
  const productCreatedAt = getCreatedAtMillis(product.createdAt);
  const cursorCreatedAt = cursor.createdAt.getTime();

  if (productCreatedAt < cursorCreatedAt) return true;
  if (productCreatedAt > cursorCreatedAt) return false;
  return String(product.id || "") > cursor.id;
}

function buildListingResult(
  products: Product[],
  pageSize: number,
  buildCursor: (createdAt: unknown, id: string) => string | undefined,
): ListingQueryResult {
  const hasMore = products.length > pageSize;
  const pageProducts = hasMore ? products.slice(0, pageSize) : products;
  const tail = pageProducts[pageProducts.length - 1];
  const nextCursor = hasMore && tail ? buildCursor(tail.createdAt, tail.id) : undefined;

  return {
    products: pageProducts,
    hasMore,
    nextCursor,
  };
}

function isFirestoreIndexError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return message.includes("requires an index") || message.includes("failed precondition");
}

function resolveProductCollectionSlug(product: Product): string {
  return slugifySegment(
    product.publicPage?.collectionSlug || resolvePublicCollection(product.category).slug,
  );
}

export async function getListingProductsWithFallback(
  params: GetListingProductsWithFallbackParams,
): Promise<ListingQueryResult> {
  const { db, organizationId, collectionFilter, cursor, pageSize, buildCursor } = params;

  try {
    let query = db
      .collection("products")
      .where("organizationId", "==", organizationId)
      .where("status", "==", "active");

    if (collectionFilter) {
      query = query.where("publicPage.collectionSlug", "==", collectionFilter);
    }

    query = query
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(pageSize + 1);

    if (cursor) {
      query = query.startAfter(cursor.createdAt, cursor.id);
    }

    const listingSnapshot = await query.get();
    const listedProducts = listingSnapshot.docs.map((entry) => snapshotToData<Product>(entry));
    return buildListingResult(listedProducts, pageSize, buildCursor);
  } catch (error) {
    if (!isFirestoreIndexError(error)) {
      throw error;
    }

    logger.warn("Falling back to scan-based public listing query", {
      organizationId,
      collectionFilter: collectionFilter || null,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const scannedProducts: Product[] = [];
  let scannedCount = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (scannedCount < LISTING_FALLBACK_SCAN_MAX_DOCS) {
    let query = db
      .collection("products")
      .where("organizationId", "==", organizationId)
      .orderBy(FieldPath.documentId(), "asc")
      .limit(LISTING_FALLBACK_SCAN_BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scannedCount += 1;
      const product = snapshotToData<Product>(entry);
      if (product.status !== "active") {
        if (scannedCount >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

      if (collectionFilter && resolveProductCollectionSlug(product) !== collectionFilter) {
        if (scannedCount >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

      scannedProducts.push(product);
      if (scannedCount >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < LISTING_FALLBACK_SCAN_BATCH_SIZE) break;
  }

  scannedProducts.sort(compareProductsForListing);
  const paged = cursor
    ? scannedProducts.filter((product) => isProductAfterCursor(product, cursor))
    : scannedProducts;

  return buildListingResult(paged.slice(0, pageSize + 1), pageSize, buildCursor);
}
