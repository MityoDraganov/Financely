import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getProductRepository } from "../repositories/product-repository";
import { getDatabaseService } from "../services/database-service";

export const onBrandSitePublicDomainUpdated = onDocumentWritten(
  {
    document: "brandSites/{brandSiteId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const organizationId =
      (after?.organizationId as string | undefined) ||
      (before?.organizationId as string | undefined);
    if (!organizationId) return;

    const beforeDomainFingerprint = JSON.stringify({
      primaryDomain: before?.primaryDomain || null,
      customDomain: before?.customDomain || null,
      deployedUrl: before?.deployedUrl || null,
      status: before?.status || null,
    });
    const afterDomainFingerprint = JSON.stringify({
      primaryDomain: after?.primaryDomain || null,
      customDomain: after?.customDomain || null,
      deployedUrl: after?.deployedUrl || null,
      status: after?.status || null,
    });

    if (beforeDomainFingerprint === afterDomainFingerprint) {
      return;
    }

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
              publicPage: {
                slug: product.publicPage?.slug,
                slugCanonical: product.publicPage?.slugCanonical,
                slugAliases: product.publicPage?.slugAliases || [],
                slugLookup: product.publicPage?.slugLookup || [],
                orgSlugCanonical: product.publicPage?.orgSlugCanonical,
                collectionSlug: product.publicPage?.collectionSlug,
                collectionLabel: product.publicPage?.collectionLabel,
                state: product.publicPage?.state || (product.status === "active" ? "published" : "unavailable"),
                canonicalPath: product.publicPage?.canonicalPath,
                canonicalUrl: product.publicPage?.canonicalUrl,
                payloadHash: product.publicPage?.payloadHash,
                listingCard: product.publicPage?.listingCard,
                detailSnapshot: product.publicPage?.detailSnapshot,
                version: product.publicPage?.version || 1,
                lastSyncRequestedAt: syncTimestamp,
                lastPublishedAt: product.publicPage?.lastPublishedAt,
                lastUnavailableAt: product.publicPage?.lastUnavailableAt,
                qr: product.publicPage?.qr,
              },
            },
          }),
        ),
      );

      logger.info("Queued product public-page refresh due to brand-site domain change", {
        organizationId,
        productCount: products.length,
      });
    } catch (error) {
      logger.error("Failed to refresh products after brand-site domain change", {
        organizationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
