import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { Product } from "../core/entities/product";
import { getProductRepository } from "../repositories/product-repository";
import { getDatabaseService } from "../services/database-service";
import { PUBLIC_PRODUCT_QR_PACKET_VERSION } from "../services/public-product-page-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

type BackfillProductPublicPagesInput = {
  organizationId: string;
  productIds?: string[];
  force?: boolean;
};

type BackfillProductPublicPagesResponse = {
  scannedCount: number;
  queuedCount: number;
  skippedCount: number;
  failedCount: number;
  triggeredProductIds: string[];
};

function productNeedsPublicPageBackfill(product: Product): boolean {
  const publicPage = product.publicPage;

  if (!publicPage) return true;
  if (!Array.isArray(publicPage.slugAliases)) return true;
  if (typeof publicPage.version !== "number" || publicPage.version < 1) return true;
  if (publicPage.state !== "published" && publicPage.state !== "unavailable") return true;

  if (product.status === "active") {
    if (!publicPage.slug || publicPage.slug.trim().length === 0) return true;
    if (!publicPage.canonicalPath || publicPage.canonicalPath.trim().length === 0) return true;
    if (!publicPage.canonicalUrl || publicPage.canonicalUrl.trim().length === 0) return true;
    if (!publicPage.qr?.assetUrl) return true;
    if ((publicPage.qr?.packetVersion || 1) < PUBLIC_PRODUCT_QR_PACKET_VERSION) return true;
  }

  return false;
}

function buildTouchedPublicPage(product: Product, syncTimestamp: string): NonNullable<Product["publicPage"]> {
  return {
    slug: product.publicPage?.slug,
    slugAliases: product.publicPage?.slugAliases || [],
    state: product.publicPage?.state || (product.status === "active" ? "published" : "unavailable"),
    canonicalPath: product.publicPage?.canonicalPath,
    canonicalUrl: product.publicPage?.canonicalUrl,
    payloadHash: product.publicPage?.payloadHash,
    version: product.publicPage?.version || 1,
    lastSyncRequestedAt: syncTimestamp,
    lastPublishedAt: product.publicPage?.lastPublishedAt,
    lastUnavailableAt: product.publicPage?.lastUnavailableAt,
    qr: product.publicPage?.qr,
  };
}

export const backfillProductPublicPages = onCall<
  BackfillProductPublicPagesInput,
  Promise<BackfillProductPublicPagesResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.organizationId) {
      throw new HttpsError("invalid-argument", "organizationId is required");
    }

    await verifyAuthAndOrgMembership(request, payload.organizationId, {
      requireOwnerOrAdmin: true,
      requireWriteAccess: true,
    });

    const databaseService = getDatabaseService();
    const productRepository = getProductRepository(databaseService);

    const requestedIds = Array.from(new Set((payload.productIds || []).filter(Boolean))).slice(0, 500);

    let products: Product[];
    if (requestedIds.length > 0) {
      const loaded = await Promise.all(requestedIds.map((id) => productRepository.get({ id })));
      products = loaded.filter((entry): entry is Product => {
        if (!entry) return false;
        return entry.organizationId === payload.organizationId;
      });
    } else {
      products = await productRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: payload.organizationId }],
      });
    }

    const now = new Date().toISOString();
    let queuedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const triggeredProductIds: string[] = [];

    for (const product of products) {
      const shouldQueue = payload.force === true || productNeedsPublicPageBackfill(product);
      if (!shouldQueue) {
        skippedCount += 1;
        continue;
      }

      try {
        await productRepository.update({
          id: product.id,
          data: { publicPage: buildTouchedPublicPage(product, now) },
        });
        queuedCount += 1;
        triggeredProductIds.push(product.id);
      } catch (error) {
        failedCount += 1;
        logger.error("Failed to queue product public-page backfill", {
          organizationId: payload.organizationId,
          productId: product.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info("Product public-page backfill request processed", {
      organizationId: payload.organizationId,
      scannedCount: products.length,
      queuedCount,
      skippedCount,
      failedCount,
      requestedIdsCount: requestedIds.length,
      forced: payload.force === true,
    });

    return {
      scannedCount: products.length,
      queuedCount,
      skippedCount,
      failedCount,
      triggeredProductIds,
    };
  },
);
