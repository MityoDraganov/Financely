/**
 * Firestore trigger to invalidate brand context cache when product data changes.
 * 
 * This ensures the cache stays in sync when products are created, updated,
 * or deleted, since products are part of brand context.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Product } from "../core/entities/product";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductMetafieldDefinitionRepository, getProductMetafieldRepository } from "../repositories/product-metafield-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getBrandContextCache } from "../services/brand-context-cache";
import { getDatabaseService } from "../services/database-service";
import {
  buildCollectionSummaries,
  buildCanonicalProductPath,
  buildPublicProductListingCard,
  buildPublicProductSnapshot,
  buildSlugLookup,
  buildQrPayload,
  normalizeSlugAliases,
  PUBLIC_PRODUCT_QR_PACKET_VERSION,
  resolvePublicCollection,
  resolvePublicProductBaseUrl,
  slugifySegment,
  storePublicQrAsset,
} from "../services/public-product-page-service";

/**
 * Triggered when a product document is created, updated, or deleted.
 * Invalidates the brand context cache for the product's organization.
 */
export const onProductWritten = onDocumentWritten(
  {
    document: "products/{productId}",
    region: "us-central1",
  },
  async (event) => {
    const productId = event.params.productId;
    
    if (!productId) {
      logger.warn("Product write trigger fired but productId is missing");
      return;
    }

    const databaseService = getDatabaseService();
    const productRepository = getProductRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);
    const productMetafieldRepository = getProductMetafieldRepository(databaseService);
    const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);
    const brandSiteRepository = getBrandSiteRepository(databaseService);

    try {
      // Get organizationId from the product data
      let organizationId: string | undefined;
      
      if (event.data?.after?.exists) {
        // Product created or updated - get organizationId from new data
        organizationId = event.data.after.data()?.organizationId;
      } else if (event.data?.before?.exists) {
        // Product deleted - get organizationId from old data
        organizationId = event.data.before.data()?.organizationId;
      }

      if (!organizationId) {
        logger.warn("Product write trigger fired but organizationId is missing", {
          productId,
        });
        return;
      }

      const cache = getBrandContextCache();
      cache.invalidate(organizationId);

      const changeType = event.data?.after?.exists
        ? (event.data?.before?.exists ? "updated" : "created")
        : "deleted";

      logger.info("Brand context cache invalidated due to product change", {
        productId,
        organizationId,
        changeType,
      });

      if (!event.data?.after?.exists) {
        try {
          const organization = await organizationRepository.get({ id: organizationId });
          if (organization) {
            const orgSlug = slugifySegment(
              organization.settings?.publicPages?.orgSlug || organization.name,
            );
            const orgSlugAliases =
              organization.settings?.publicPages?.orgSlugAliases || [];
            const orgProducts = await productRepository.getAll({
              queryConstraints: [{ field: "organizationId", operator: "==", value: organizationId }],
            });
            const collectionSummaries = buildCollectionSummaries(orgProducts);
            await databaseService.set("publicCatalogs", organization.id, {
              organizationId: organization.id,
              orgSlugCanonical: orgSlug,
              orgSlugAliases,
              collections: collectionSummaries,
            });
          }
        } catch (catalogError) {
          logger.warn("Failed to refresh public catalog index after product delete", {
            organizationId,
            error: catalogError instanceof Error ? catalogError.message : "Unknown error",
          });
        }
        return;
      }

      const before = event.data?.before?.exists
        ? (event.data.before.data() as Record<string, unknown>)
        : null;

      const currentProduct = await productRepository.get({ id: productId });
      if (!currentProduct) {
        logger.warn("Product document missing after write trigger", { productId });
        return;
      }

      const organization = await organizationRepository.get({ id: currentProduct.organizationId });
      if (!organization) {
        logger.warn("Organization missing for product public-page update", {
          productId,
          organizationId: currentProduct.organizationId,
        });
        return;
      }

      const orgSlug = slugifySegment(
        organization.settings?.publicPages?.orgSlug || organization.name,
      );
      const requestedSlug = slugifySegment(
        currentProduct.publicPage?.slug || currentProduct.name,
      );

      const orgProducts = await productRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: currentProduct.organizationId }],
      });
      const usedSlugs = new Set(
        orgProducts
          .filter((entry) => entry.id !== currentProduct.id)
          .map((entry) => slugifySegment(entry.publicPage?.slug || entry.name)),
      );

      let uniqueSlug = requestedSlug;
      let suffix = 2;
      while (usedSlugs.has(uniqueSlug)) {
        uniqueSlug = `${requestedSlug}-${suffix}`;
        suffix += 1;
      }

      const existingAliases = Array.isArray(currentProduct.publicPage?.slugAliases)
        ? currentProduct.publicPage?.slugAliases
        : [];
      const previousSlug = before
        ? slugifySegment(
            ((before.publicPage as { slug?: string } | undefined)?.slug as string | undefined) ||
              (before.name as string | undefined) ||
              currentProduct.name,
          )
        : null;
      const slugAliases = normalizeSlugAliases(
        previousSlug && previousSlug !== uniqueSlug
          ? [...existingAliases, previousSlug]
          : existingAliases,
        uniqueSlug,
      );

      const canonicalPath = buildCanonicalProductPath(orgSlug, uniqueSlug);
      const brandSites = await brandSiteRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
      });
      const baseUrl = resolvePublicProductBaseUrl(organization, brandSites);
      const canonicalUrl = `${baseUrl}${canonicalPath}`;
      const collection = resolvePublicCollection(currentProduct.category);
      const slugLookup = buildSlugLookup(uniqueSlug, slugAliases);
      const now = new Date().toISOString();
      const shouldBePublished = currentProduct.status === "active";
      const nextState: "published" | "unavailable" = shouldBePublished ? "published" : "unavailable";
      const previousState = currentProduct.publicPage?.state;
      const becamePublished = shouldBePublished && previousState !== "published";
      const becameUnavailable = !shouldBePublished && previousState !== "unavailable";

      let payloadHash: string | undefined;
      let qr:
        | {
            assetUrl?: string;
            payloadMode: "hybrid" | "text-only";
            payloadHash?: string;
            packetVersion: number;
            generatedAt?: string;
            storagePath?: string;
            version: number;
          }
        | undefined;
      let detailSnapshot:
        | {
            fields: ReturnType<typeof buildPublicProductSnapshot>["fields"];
            metafields: ReturnType<typeof buildPublicProductSnapshot>["metafields"];
          }
        | undefined;

      if (shouldBePublished) {
        const metafields = await productMetafieldRepository.getAll({
          queryConstraints: [
            { field: "organizationId", operator: "==", value: organization.id },
            { field: "productId", operator: "==", value: currentProduct.id },
          ],
        });
        const definitions = await productMetafieldDefinitionRepository.getAll({
          queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
        });
        const snapshot = buildPublicProductSnapshot(currentProduct, metafields, definitions);
        detailSnapshot = {
          fields: snapshot.fields,
          metafields: snapshot.metafields,
        };
        const qrPayload = buildQrPayload(canonicalUrl, snapshot);
        payloadHash = qrPayload.payloadHash;

        const existingQr = currentProduct.publicPage?.qr;
        const unchangedQr =
          existingQr?.payloadHash === qrPayload.payloadHash &&
          existingQr?.assetUrl &&
          existingQr?.payloadMode === qrPayload.mode &&
          (existingQr?.packetVersion || 1) === qrPayload.packetVersion;

        if (unchangedQr) {
          qr = {
            assetUrl: existingQr.assetUrl,
            payloadMode: existingQr.payloadMode,
            payloadHash: existingQr.payloadHash,
            packetVersion: existingQr.packetVersion || PUBLIC_PRODUCT_QR_PACKET_VERSION,
            generatedAt: existingQr.generatedAt,
            storagePath: existingQr.storagePath,
            version: existingQr.version || 1,
          };
        } else {
          try {
            const storagePath = `organizations/${organization.id}/public-products/${currentProduct.id}/qr-${qrPayload.payloadHash.slice(0, 16)}.png`;
            const assetUrl = await storePublicQrAsset(storagePath, qrPayload.payload);
            qr = {
              assetUrl,
              payloadMode: qrPayload.mode,
              payloadHash: qrPayload.payloadHash,
              packetVersion: qrPayload.packetVersion,
              generatedAt: now,
              storagePath,
              version: (existingQr?.version || 0) + 1,
            };
          } catch (qrError) {
            logger.error("Failed generating/storing product QR", {
              productId,
              organizationId: organization.id,
              error: qrError instanceof Error ? qrError.message : "Unknown error",
            });
            qr = {
              assetUrl: currentProduct.publicPage?.qr?.assetUrl,
              payloadMode: qrPayload.mode,
              payloadHash: qrPayload.payloadHash,
              packetVersion: qrPayload.packetVersion,
              generatedAt: currentProduct.publicPage?.qr?.generatedAt,
              storagePath: currentProduct.publicPage?.qr?.storagePath,
              version: currentProduct.publicPage?.qr?.version || 1,
            };
          }
        }
      }
      const listingCard = buildPublicProductListingCard(
        currentProduct,
        canonicalPath,
        canonicalUrl,
      );

      const nextPublicPageBase: NonNullable<Product["publicPage"]> = {
        slug: uniqueSlug,
        slugCanonical: uniqueSlug,
        slugAliases,
        slugLookup,
        orgSlugCanonical: orgSlug,
        collectionSlug: collection.slug,
        collectionLabel: collection.label,
        state: nextState,
        canonicalPath,
        canonicalUrl,
        payloadHash: shouldBePublished ? payloadHash : undefined,
        listingCard,
        detailSnapshot: shouldBePublished ? detailSnapshot : currentProduct.publicPage?.detailSnapshot,
        version: currentProduct.publicPage?.version || 1,
        lastSyncRequestedAt: currentProduct.publicPage?.lastSyncRequestedAt,
        lastPublishedAt: becamePublished ? now : currentProduct.publicPage?.lastPublishedAt,
        lastUnavailableAt: becameUnavailable ? now : currentProduct.publicPage?.lastUnavailableAt,
        qr: shouldBePublished ? qr : currentProduct.publicPage?.qr,
      };

      const previousComparable = {
        ...(currentProduct.publicPage || {}),
        version: currentProduct.publicPage?.version || 1,
      };
      const nextComparable = {
        ...nextPublicPageBase,
        version: currentProduct.publicPage?.version || 1,
      };
      const didChange = JSON.stringify(nextComparable) !== JSON.stringify(previousComparable);
      const nextPublicPage = {
        ...nextPublicPageBase,
        version: didChange ? (currentProduct.publicPage?.version || 0) + 1 : currentProduct.publicPage?.version || 1,
      };

      if (didChange) {
        await productRepository.update({
          id: currentProduct.id,
          data: { publicPage: nextPublicPage },
        });
      }

      try {
        const collectionSummaries = buildCollectionSummaries(orgProducts);
        const orgSlugAliases =
          organization.settings?.publicPages?.orgSlugAliases || [];
        await databaseService.set("publicCatalogs", organization.id, {
          organizationId: organization.id,
          orgSlugCanonical: orgSlug,
          orgSlugAliases,
          collections: collectionSummaries,
        });
      } catch (catalogError) {
        logger.warn("Failed to refresh public catalog index", {
          organizationId: organization.id,
          productId: currentProduct.id,
          error: catalogError instanceof Error ? catalogError.message : "Unknown error",
        });
      }
    } catch (error) {
      logger.error("Failed to invalidate brand context cache on product change", {
        productId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
);
