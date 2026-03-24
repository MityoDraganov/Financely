import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Product } from "../core/entities/product";
import { getProductRepository } from "../repositories/product-repository";
import { getDatabaseService } from "../services/database-service";

function buildTouchedPublicPage(product: Product, syncTimestamp: string): NonNullable<Product["publicPage"]> {
  const existing = product.publicPage;
  return {
    slug: existing?.slug,
    slugCanonical: existing?.slugCanonical,
    slugAliases: existing?.slugAliases || [],
    slugLookup: existing?.slugLookup || [],
    orgSlugCanonical: existing?.orgSlugCanonical,
    collectionSlug: existing?.collectionSlug,
    collectionLabel: existing?.collectionLabel,
    state: existing?.state || (product.status === "active" ? "published" : "unavailable"),
    canonicalPath: existing?.canonicalPath,
    canonicalUrl: existing?.canonicalUrl,
    payloadHash: existing?.payloadHash,
    listingCard: existing?.listingCard,
    detailSnapshot: existing?.detailSnapshot,
    version: existing?.version || 1,
    lastSyncRequestedAt: syncTimestamp,
    lastPublishedAt: existing?.lastPublishedAt,
    lastUnavailableAt: existing?.lastUnavailableAt,
    qr: existing?.qr,
  };
}

export const onProductMetafieldWritten = onDocumentWritten(
  {
    document: "productMetafields/{metafieldId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const organizationId =
      (after?.organizationId as string | undefined) ||
      (before?.organizationId as string | undefined);
    const productId =
      (after?.productId as string | undefined) ||
      (before?.productId as string | undefined);
    if (!organizationId || !productId) return;

    try {
      const productRepository = getProductRepository(getDatabaseService());
      const product = await productRepository.get({ id: productId });
      if (!product || product.organizationId !== organizationId) return;

      await productRepository.update({
        id: product.id,
        data: {
          publicPage: buildTouchedPublicPage(product, new Date().toISOString()),
        },
      });

      logger.info("Queued product public-page refresh due to product metafield change", {
        organizationId,
        productId,
      });
    } catch (error) {
      logger.error("Failed to refresh product public-page after metafield change", {
        organizationId,
        productId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export const onProductMetafieldDefinitionWritten = onDocumentWritten(
  {
    document: "productMetafieldDefinitions/{definitionId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const organizationId =
      (after?.organizationId as string | undefined) ||
      (before?.organizationId as string | undefined);
    if (!organizationId) return;

    try {
      const productRepository = getProductRepository(getDatabaseService());
      const products = await productRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organizationId }],
      });
      const syncTimestamp = new Date().toISOString();

      await Promise.all(
        products.map((product) =>
          productRepository.update({
            id: product.id,
            data: {
              publicPage: buildTouchedPublicPage(product, syncTimestamp),
            },
          }),
        ),
      );

      logger.info("Queued product public-page refresh due to product metafield definition change", {
        organizationId,
        productCount: products.length,
      });
    } catch (error) {
      logger.error("Failed to refresh product public-pages after metafield definition change", {
        organizationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
