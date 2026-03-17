import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductMetafieldDefinitionRepository, getProductMetafieldRepository } from "../repositories/product-metafield-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getDatabaseService } from "../services/database-service";
import {
  buildCanonicalProductPath,
  buildPublicProductSnapshot,
  normalizeSlugAliases,
  resolvePublicProductBaseUrl,
  slugifySegment,
} from "../services/public-product-page-service";
import { checkRequestSize, extractIpFromRequest, getRateLimiter } from "../middleware";
import { getConfigCache } from "../middleware/config-cache";

type PublicProductPageResponse =
  | {
      kind: "ok";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        image?: string;
        robots: "index,follow";
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
        logoUrl?: string;
      };
      product: {
        id: string;
        state: "published";
        fields: ReturnType<typeof buildPublicProductSnapshot>["fields"];
        metafields: ReturnType<typeof buildPublicProductSnapshot>["metafields"];
        qr?: {
          assetUrl?: string;
          payloadMode?: "hybrid" | "text-only";
          generatedAt?: string;
          payloadHash?: string;
        };
        publicPage?: {
          version?: number;
          payloadHash?: string;
          lastPublishedAt?: string;
        };
      };
    }
  | {
      kind: "redirect";
      canonicalPath: string;
      canonicalUrl: string;
    }
  | {
      kind: "unavailable";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        robots: "index,follow";
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
      };
      product: {
        id: string;
        state: "unavailable";
      };
    };

const FUNCTION_NAME = "get-public-product-page";

export const getPublicProductPage = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request, response) => {
    const ipAddress = extractIpFromRequest(request);

    try {
      if (request.method !== "GET") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const sizeCheck = checkRequestSize(request, FUNCTION_NAME);
      if (!sizeCheck.isValid) {
        response.status(400).json({ error: sizeCheck.error || "Request too large" });
        return;
      }

      const rawOrgSlug = typeof request.query.orgSlug === "string" ? request.query.orgSlug : "";
      const rawProductSlug = typeof request.query.productSlug === "string" ? request.query.productSlug : "";
      const orgSlug = slugifySegment(rawOrgSlug);
      const productSlug = slugifySegment(rawProductSlug);

      if (!rawOrgSlug || !rawProductSlug) {
        response.status(400).json({ error: "orgSlug and productSlug query params are required" });
        return;
      }

      const rateLimiter = getRateLimiter();
      const rateLimitResult = await rateLimiter.checkLimit(FUNCTION_NAME, ipAddress);
      rateLimiter.logRateLimitEvent(FUNCTION_NAME, rateLimitResult, ipAddress);
      if (!rateLimitResult.allowed) {
        response.status(429).json({
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.resetIn,
        });
        return;
      }

      const responseMode = typeof request.query.mode === "string" ? request.query.mode : "http";
      const useJsonMode = responseMode === "json";

      const cache = getConfigCache();
      const cacheKey = `${FUNCTION_NAME}:${orgSlug}:${productSlug}:${useJsonMode ? "json" : "http"}`;
      const cached = cache.get<PublicProductPageResponse>(cacheKey);
      if (cached) {
        response.setHeader("Cache-Control", "public, max-age=300");
        response.setHeader("X-Cache", "HIT");
        if (cached.kind === "redirect" && !useJsonMode) {
          response.redirect(301, cached.canonicalUrl);
          return;
        }
        if (cached.kind === "unavailable") {
          response.status(200).json(cached);
          return;
        }
        response.status(200).json(cached);
        return;
      }

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);
      const productRepository = getProductRepository(databaseService);
      const productMetafieldRepository = getProductMetafieldRepository(databaseService);
      const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const orgBySlug = await organizationRepository.getAll({
        queryConstraints: [{ field: "settings.publicPages.orgSlug", operator: "==", value: orgSlug }],
        pagination: { limit: 1 },
      });
      const orgByAlias =
        orgBySlug.length > 0
          ? []
          : await organizationRepository.getAll({
              queryConstraints: [{ field: "settings.publicPages.orgSlugAliases", operator: "array-contains", value: orgSlug }],
              pagination: { limit: 1 },
            });
      let organization: (typeof orgBySlug)[number] | null = (orgBySlug[0] || orgByAlias[0]) ?? null;

      if (!organization) {
        const activeOrganizations = await organizationRepository.getAll({
          queryConstraints: [{ field: "status", operator: "==", value: "active" }],
        });
        organization =
          activeOrganizations.find((entry) => {
            const candidateSlug = slugifySegment(
              entry.settings?.publicPages?.orgSlug || entry.name,
            );
            if (candidateSlug === orgSlug) return true;
            const aliases = normalizeSlugAliases(
              entry.settings?.publicPages?.orgSlugAliases || [],
              candidateSlug,
            );
            return aliases.includes(orgSlug);
          }) || null;
      }

      if (!organization || organization.status !== "active") {
        response.status(404).json({ error: "Public product page not found" });
        return;
      }

      const canonicalOrgSlug = slugifySegment(
        organization.settings?.publicPages?.orgSlug || organization.name,
      );

      const organizationProducts = await productRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
      });

      const product = organizationProducts.find((entry) => {
        const currentSlug = slugifySegment(entry.publicPage?.slug || entry.name);
        if (currentSlug === productSlug) return true;
        const aliases = normalizeSlugAliases(entry.publicPage?.slugAliases, currentSlug);
        return aliases.includes(productSlug);
      });

      if (!product) {
        response.status(404).json({ error: "Public product page not found" });
        return;
      }

      const canonicalProductSlug = slugifySegment(product.publicPage?.slug || product.name);
      const canonicalPath = buildCanonicalProductPath(canonicalOrgSlug, canonicalProductSlug);
      const brandSites = await brandSiteRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
      });
      const baseUrl = resolvePublicProductBaseUrl(organization, brandSites);
      const canonicalUrl = `${baseUrl}${canonicalPath}`;

      const shouldRedirect = canonicalOrgSlug !== orgSlug || canonicalProductSlug !== productSlug;
      if (shouldRedirect) {
        const redirectPayload: PublicProductPageResponse = {
          kind: "redirect",
          canonicalPath,
          canonicalUrl,
        };
        cache.set(cacheKey, redirectPayload, 300);
        response.setHeader("Cache-Control", "public, max-age=300");
        if (!useJsonMode) {
          response.redirect(301, canonicalUrl);
          return;
        }
        response.status(200).json(redirectPayload);
        return;
      }

      if (product.status !== "active") {
        const unavailablePayload: PublicProductPageResponse = {
          kind: "unavailable",
          canonicalPath,
          canonicalUrl,
          seo: {
            title: `${product.name} is unavailable`,
            description: "This product is currently unavailable.",
            canonicalUrl,
            robots: "index,follow",
          },
          organization: {
            id: organization.id,
            name: organization.name,
            orgSlug: canonicalOrgSlug,
          },
          product: {
            id: product.id,
            state: "unavailable",
          },
        };
        cache.set(cacheKey, unavailablePayload, 300);
        response.setHeader("Cache-Control", "public, max-age=300");
        response.status(200).json(unavailablePayload);
        return;
      }

      const metafields = await productMetafieldRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organization.id },
          { field: "productId", operator: "==", value: product.id },
        ],
      });
      const definitions = await productMetafieldDefinitionRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
      });

      const snapshot = buildPublicProductSnapshot(product, metafields, definitions);
      const pagePayload: PublicProductPageResponse = {
        kind: "ok",
        canonicalPath,
        canonicalUrl,
        seo: {
          title: `${snapshot.fields.name} · ${organization.name}`,
          description: snapshot.fields.description || `View ${snapshot.fields.name} details`,
          canonicalUrl,
          image: snapshot.fields.images?.[0],
          robots: "index,follow",
        },
        organization: {
          id: organization.id,
          name: organization.name,
          orgSlug: canonicalOrgSlug,
          logoUrl: organization.settings?.branding?.customLogo || organization.logoUrl,
        },
        product: {
          id: product.id,
          state: "published",
          fields: snapshot.fields,
          metafields: snapshot.metafields,
          qr: {
            assetUrl: product.publicPage?.qr?.assetUrl,
            payloadMode: product.publicPage?.qr?.payloadMode,
            generatedAt: product.publicPage?.qr?.generatedAt,
            payloadHash: product.publicPage?.qr?.payloadHash,
          },
          publicPage: {
            version: product.publicPage?.version,
            payloadHash: product.publicPage?.payloadHash,
            lastPublishedAt: product.publicPage?.lastPublishedAt,
          },
        },
      };

      cache.set(cacheKey, pagePayload, 300);
      response.setHeader("Cache-Control", "public, max-age=300");
      response.setHeader("X-Cache", "MISS");
      response.status(200).json(pagePayload);
    } catch (error) {
      logger.error("Failed to resolve public product page", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: request.query,
      });
      response.status(500).json({ error: "Internal server error" });
    }
  },
);
