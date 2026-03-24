/**
 * Firestore trigger to invalidate brand context cache when organization data changes.
 * 
 * This ensures the cache stays in sync when organization settings, branding,
 * or other brand-relevant data is updated from the frontend.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getBrandContextCache } from "../services/brand-context-cache";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getDatabaseService } from "../services/database-service";
import { normalizeSlugAliases } from "../services/public-product-page-service";
import {
  normalizePublicOrgSlug,
  resolveUniqueOrganizationSlug,
} from "../services/organization-public-slug-service";

/**
 * Triggered when an organization document is updated.
 * Invalidates the brand context cache for that organization.
 */
export const onOrganizationUpdated = onDocumentUpdated(
  {
    document: "organizations/{organizationId}",
    region: "us-central1",
  },
  async (event) => {
    const organizationId = event.params.organizationId;
    
    if (!organizationId) {
      logger.warn("Organization update trigger fired but organizationId is missing");
      return;
    }

    try {
      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      const before = event.data?.before.data() as Record<string, unknown> | undefined;
      const after = event.data?.after.data() as Record<string, unknown> | undefined;
      if (!after) return;

      const beforePublicPages = (before?.settings as {
        publicPages?: { orgSlug?: string; orgSlugAliases?: string[]; domainPreference?: "custom-first" | "app-only" };
      } | undefined)?.publicPages;
      const afterPublicPages = (after.settings as {
        publicPages?: { orgSlug?: string; orgSlugAliases?: string[]; domainPreference?: "custom-first" | "app-only" };
      } | undefined)?.publicPages;

      const afterName = (after.name as string | undefined) || "";
      const previousSlug = normalizePublicOrgSlug(
        beforePublicPages?.orgSlug || (before?.name as string | undefined) || "",
        organizationId,
      );
      const requestedSlug = normalizePublicOrgSlug(
        afterPublicPages?.orgSlug || afterName,
        organizationId,
      );
      const currentRequestedSlug = await resolveUniqueOrganizationSlug({
        requestedSlug,
        fallbackName: afterName,
        organizationId,
      });
      const mergedAliases = normalizeSlugAliases(
        [
          ...(afterPublicPages?.orgSlugAliases || []),
          ...(previousSlug && previousSlug !== currentRequestedSlug ? [previousSlug] : []),
          ...(requestedSlug && requestedSlug !== currentRequestedSlug ? [requestedSlug] : []),
        ],
        currentRequestedSlug,
      );

      const normalizedPublicPages = {
        orgSlug: currentRequestedSlug,
        orgSlugAliases: mergedAliases,
        domainPreference: afterPublicPages?.domainPreference || "custom-first",
      };

      const existingNormalized = {
        orgSlug: afterPublicPages?.orgSlug || "",
        orgSlugAliases: afterPublicPages?.orgSlugAliases || [],
        domainPreference: afterPublicPages?.domainPreference || "custom-first",
      };

      if (JSON.stringify(normalizedPublicPages) !== JSON.stringify(existingNormalized)) {
        const nextSettings = {
          ...(after.settings as Record<string, unknown>),
          publicPages: normalizedPublicPages,
        };
        await organizationRepository.update({
          id: organizationId,
          data: { settings: nextSettings as any },
        });

        const productRepository = getProductRepository(databaseService);
        const orgProducts = await productRepository.getAll({
          queryConstraints: [{ field: "organizationId", operator: "==", value: organizationId }],
        });
        const syncTimestamp = new Date().toISOString();
        await Promise.all(
          orgProducts.map((product) =>
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
      }

      const cache = getBrandContextCache();
      cache.invalidate(organizationId);
      
      logger.info("Brand context cache invalidated due to organization update", {
        organizationId,
      });
    } catch (error) {
      logger.error("Failed to invalidate brand context cache on organization update", {
        organizationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - cache invalidation failure shouldn't break the update
    }
  }
);
