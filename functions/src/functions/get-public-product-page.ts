import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { Organization } from "../core/entities/organization";
import { Product } from "../core/entities/product";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import {
  getProductMetafieldDefinitionRepository,
  getProductMetafieldRepository,
} from "../repositories/product-metafield-repository";
import { snapshotToData } from "../services/database-service";
import { getDatabaseService } from "../services/database-service";
import {
  buildCanonicalCollectionPath,
  buildCanonicalOrgProductsPath,
  buildCanonicalProductPath,
  buildPublicProductListingCard,
  buildPublicProductSnapshot,
  PublicCollectionSummary,
  PublicProductListingCard,
  resolvePublicCollection,
  resolvePublicProductBaseUrl,
  slugifySegment,
} from "../services/public-product-page-service";
import {
  checkRequestSize,
  extractIpFromRequest,
  getRateLimiter,
} from "../middleware";
import { getConfigCache } from "../middleware/config-cache";

type PublicBreadcrumbItem = {
  label: string;
  path?: string;
};

type PublicSeoPayload = {
  title: string;
  description: string;
  canonicalUrl: string;
  image?: string;
  robots: "index,follow";
};

type PublicOrganizationPayload = {
  id: string;
  name: string;
  orgSlug: string;
  logoUrl?: string;
};

type PublicCollectionNavigationItem = {
  slug: string;
  label: string;
  count: number;
  path: string;
};

type PublicListingPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
};

type PublicCatalogResponse =
  | {
      kind: "redirect";
      canonicalPath: string;
      canonicalUrl: string;
    }
  | {
      kind: "org_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      collections: PublicCollectionNavigationItem[];
      listing: {
        items: PublicProductListingCard[];
        pagination: PublicListingPagination;
      };
    }
  | {
      kind: "collection_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      collection: {
        slug: string;
        label: string;
        path: string;
      };
      collections: PublicCollectionNavigationItem[];
      listing: {
        items: PublicProductListingCard[];
        pagination: PublicListingPagination;
      };
    }
  | {
      kind: "product_detail";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      product: {
        id: string;
        state: "published" | "unavailable";
        fields?: ReturnType<typeof buildPublicProductSnapshot>["fields"];
        metafields?: ReturnType<typeof buildPublicProductSnapshot>["metafields"];
        publicPage?: {
          version?: number;
          payloadHash?: string;
          lastPublishedAt?: string;
        };
      };
    };

type RequestedPageKind = "org_products" | "collection_products" | "product_detail";
type ListingCursor = {
  createdAt: string;
  id: string;
};
type PublicMetafieldPayload = ReturnType<
  typeof buildPublicProductSnapshot
>["metafields"][number];

const FUNCTION_NAME = "get-public-product-page";
const PAGE_SIZE = 24;
const CACHE_SECONDS = 300;
const ORG_LOOKUP_CACHE_PREFIX = `${FUNCTION_NAME}:org-lookup`;
const ORG_LOOKUP_MISS_TOKEN = "__MISS__";
const ORG_FALLBACK_SCAN_BATCH_SIZE = 200;
const ORG_FALLBACK_SCAN_MAX_DOCS = 2000;
const PRODUCT_FALLBACK_SCAN_BATCH_SIZE = 200;
const PRODUCT_FALLBACK_SCAN_MAX_DOCS = 2000;

function toIsoDate(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (value && typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

function buildCursor(createdAt: unknown, id: string): string | undefined {
  const createdAtIso = toIsoDate(createdAt);
  if (!createdAtIso || !id) return undefined;
  const payload: ListingCursor = { createdAt: createdAtIso, id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function parseCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<ListingCursor>;
    if (!parsed.createdAt || !parsed.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function resolvePreferredLocale(acceptLanguageHeader: string | undefined): string {
  const candidate = acceptLanguageHeader?.split(",")[0]?.trim();
  return candidate || "en";
}

function formatMonthLabel(month: number, locale: string): string {
  const date = new Date(Date.UTC(2000, month - 1, 1));
  try {
    return new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", { month: "long" }).format(date);
  }
}

function formatDateLabel(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }
}

function formatDateTimeLabel(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function parseMonthToken(raw: string): { month: number; year?: number } | null {
  const compact = raw.trim();
  const monthOnly = compact.match(/^(\d{2})$/);
  if (monthOnly) {
    const month = Number(monthOnly[1]);
    if (!Number.isFinite(month) || month < 1 || month > 12) return null;
    return { month };
  }

  const yearMonth = compact.match(/^(\d{4})-(\d{2})$/);
  if (!yearMonth) return null;
  const year = Number(yearMonth[1]);
  const month = Number(yearMonth[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function parseIsoDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const date = new Date(`${raw.trim()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function splitPeriod(raw: string): [string, string] | null {
  if (raw.includes("..")) {
    const [start, end] = raw.split("..");
    if (!start || !end) return null;
    return [start.trim(), end.trim()];
  }
  if (raw.includes(" - ")) {
    const [start, end] = raw.split(" - ");
    if (!start || !end) return null;
    return [start.trim(), end.trim()];
  }
  return null;
}

function localizeDateMetafieldDisplayValue(
  metafield: PublicMetafieldPayload,
  locale: string,
): string {
  const raw =
    typeof metafield.value === "string" && metafield.value.trim().length > 0
      ? metafield.value.trim()
      : metafield.displayValue.trim();

  if (!raw) return metafield.displayValue;

  if (metafield.type === "date") {
    const period = splitPeriod(raw);
    if (period) {
      const [startRaw, endRaw] = period;
      const startMonth = parseMonthToken(startRaw);
      const endMonth = parseMonthToken(endRaw);
      if (startMonth && endMonth) {
        const startLabel = formatMonthLabel(startMonth.month, locale);
        const endLabel = formatMonthLabel(endMonth.month, locale);
        if (!startMonth.year && !endMonth.year) {
          return `${startLabel} - ${endLabel}`;
        }
        if (startMonth.year && endMonth.year && startMonth.year !== endMonth.year) {
          return `${startLabel} ${startMonth.year} - ${endLabel} ${endMonth.year}`;
        }
        return `${startLabel} - ${endLabel}`;
      }

      const startDate = parseIsoDate(startRaw);
      const endDate = parseIsoDate(endRaw);
      if (startDate && endDate) {
        return `${formatDateLabel(startDate, locale)} - ${formatDateLabel(endDate, locale)}`;
      }
    }

    const singleMonth = parseMonthToken(raw);
    if (singleMonth) {
      const monthLabel = formatMonthLabel(singleMonth.month, locale);
      return singleMonth.year ? `${monthLabel} ${singleMonth.year}` : monthLabel;
    }

    const singleDate = parseIsoDate(raw);
    if (singleDate) {
      return formatDateLabel(singleDate, locale);
    }

    return metafield.displayValue;
  }

  if (metafield.type === "date_time") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateTimeLabel(parsed, locale);
    }
  }

  return metafield.displayValue;
}

function localizeMetafieldsForLocale(
  metafields: PublicMetafieldPayload[],
  locale: string,
): PublicMetafieldPayload[] {
  return metafields.map((metafield) => {
    if (metafield.type !== "date") {
      return metafield;
    }
    if (metafield.dateDisplayMode !== "localized") {
      return metafield;
    }
    return {
      ...metafield,
      displayValue: localizeDateMetafieldDisplayValue(metafield, locale),
    };
  });
}

function buildOrganizationPayload(
  organization: Organization,
  canonicalOrgSlug: string,
): PublicOrganizationPayload {
  return {
    id: organization.id,
    name: organization.name,
    orgSlug: canonicalOrgSlug,
    logoUrl: organization.settings?.branding?.customLogo || organization.logoUrl,
  };
}

function buildCollectionNavigation(
  canonicalOrgSlug: string,
  collections: PublicCollectionSummary[],
): PublicCollectionNavigationItem[] {
  const entries = [...collections];
  if (!entries.some((entry) => entry.slug === "uncategorized")) {
    entries.push({ slug: "uncategorized", label: "Uncategorized", count: 0 });
  }

  return entries
    .sort((a, b) => {
      if (a.slug === "uncategorized" && b.slug !== "uncategorized") return 1;
      if (b.slug === "uncategorized" && a.slug !== "uncategorized") return -1;
      return a.label.localeCompare(b.label);
    })
    .map((entry) => ({
      slug: entry.slug,
      label: entry.label,
      count: entry.count,
      path: buildCanonicalCollectionPath(canonicalOrgSlug, entry.slug),
    }));
}

async function getOrganizationBySlug(orgSlug: string): Promise<Organization | null> {
  const cache = getConfigCache();
  const cacheKey = `${ORG_LOOKUP_CACHE_PREFIX}:${orgSlug}`;
  const cached = cache.get<Organization | typeof ORG_LOOKUP_MISS_TOKEN>(cacheKey);
  if (cached) {
    return cached === ORG_LOOKUP_MISS_TOKEN ? null : cached;
  }

  const db = getFirestore();
  const bySlugSnapshot = await db
    .collection("organizations")
    .where("settings.publicPages.orgSlug", "==", orgSlug)
    .limit(1)
    .get();

  if (!bySlugSnapshot.empty) {
    const organization = snapshotToData<Organization>(bySlugSnapshot.docs[0]);
    cache.set(cacheKey, organization, CACHE_SECONDS);
    return organization;
  }

  const byAliasSnapshot = await db
    .collection("organizations")
    .where("settings.publicPages.orgSlugAliases", "array-contains", orgSlug)
    .limit(1)
    .get();

  if (!byAliasSnapshot.empty) {
    const organization = snapshotToData<Organization>(byAliasSnapshot.docs[0]);
    cache.set(cacheKey, organization, CACHE_SECONDS);
    return organization;
  }

  const fallback = await getOrganizationBySlugFallback(orgSlug);
  if (fallback) {
    cache.set(cacheKey, fallback, CACHE_SECONDS);
    return fallback;
  }

  cache.set(cacheKey, ORG_LOOKUP_MISS_TOKEN, Math.min(CACHE_SECONDS, 60));
  return null;
}

function toCompactSlug(value: string): string {
  return value.replace(/-/g, "");
}

function collectOrganizationLookupSlugs(organization: Organization): string[] {
  const deduped = new Set<string>();
  const canonicalSlug = slugifySegment(
    organization.settings?.publicPages?.orgSlug || organization.name,
  );
  if (canonicalSlug) {
    deduped.add(canonicalSlug);
  }

  for (const alias of organization.settings?.publicPages?.orgSlugAliases || []) {
    const normalizedAlias = slugifySegment(alias);
    if (!normalizedAlias) continue;
    deduped.add(normalizedAlias);
  }

  return Array.from(deduped);
}

function collectProductLookupSlugs(product: Product): string[] {
  const deduped = new Set<string>();
  const candidates = [
    product.publicPage?.slugCanonical,
    product.publicPage?.slug,
    product.name,
    ...(product.publicPage?.slugAliases || []),
    ...(product.publicPage?.slugLookup || []),
  ];
  for (const candidate of candidates) {
    const normalized = slugifySegment(String(candidate || ""));
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

async function getProductBySlugFallback(
  organizationId: string,
  requestedProductSlug: string,
): Promise<Product | null> {
  const db = getFirestore();
  const requestedCompactSlug = toCompactSlug(requestedProductSlug);
  let scanned = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let firstMatch: Product | null = null;
  let firstActiveMatch: Product | null = null;

  while (scanned < PRODUCT_FALLBACK_SCAN_MAX_DOCS) {
    let query = db
      .collection("products")
      .where("organizationId", "==", organizationId)
      .orderBy(FieldPath.documentId(), "asc")
      .limit(PRODUCT_FALLBACK_SCAN_BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scanned += 1;
      const product = snapshotToData<Product>(entry);
      const slugs = collectProductLookupSlugs(product);
      const directMatch = slugs.includes(requestedProductSlug);
      const compactMatch = slugs.some(
        (slug) => toCompactSlug(slug) === requestedCompactSlug,
      );
      if (!directMatch && !compactMatch) {
        if (scanned >= PRODUCT_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

      if (!firstMatch) firstMatch = product;
      if (product.status === "active" && !firstActiveMatch) {
        firstActiveMatch = product;
        logger.warn("Resolved product slug through fallback lookup", {
          organizationId,
          productId: product.id,
          requestedProductSlug,
          scannedCount: scanned,
        });
        return firstActiveMatch;
      }

      if (scanned >= PRODUCT_FALLBACK_SCAN_MAX_DOCS) break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PRODUCT_FALLBACK_SCAN_BATCH_SIZE) break;
  }

  if (firstMatch) {
    logger.warn("Resolved non-active product slug through fallback lookup", {
      organizationId,
      productId: firstMatch.id,
      requestedProductSlug,
      scannedCount: scanned,
    });
    return firstMatch;
  }

  return null;
}

async function getOrganizationBySlugFallback(orgSlug: string): Promise<Organization | null> {
  const db = getFirestore();
  const requestedCompactSlug = toCompactSlug(orgSlug);
  let scanned = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (scanned < ORG_FALLBACK_SCAN_MAX_DOCS) {
    let query = db
      .collection("organizations")
      .where("status", "==", "active")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(ORG_FALLBACK_SCAN_BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scanned += 1;
      const organization = snapshotToData<Organization>(entry);
      const candidates = collectOrganizationLookupSlugs(organization);

      if (candidates.includes(orgSlug)) {
        logger.warn("Resolved public org slug through legacy fallback lookup", {
          orgSlug,
          organizationId: organization.id,
          scannedCount: scanned,
          reason: "direct-match-during-fallback",
        });
        return organization;
      }

      if (requestedCompactSlug) {
        const compactMatch = candidates.some(
          (candidate) => toCompactSlug(candidate) === requestedCompactSlug,
        );
        if (compactMatch) {
          logger.warn("Resolved public org slug through compact fallback lookup", {
            orgSlug,
            organizationId: organization.id,
            scannedCount: scanned,
            reason: "compact-slug-match",
          });
          return organization;
        }
      }

      if (scanned >= ORG_FALLBACK_SCAN_MAX_DOCS) break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < ORG_FALLBACK_SCAN_BATCH_SIZE) break;
  }

  return null;
}

async function getCatalogCollections(
  organizationId: string,
): Promise<PublicCollectionSummary[]> {
  const db = getFirestore();
  const catalogSnapshot = await db.collection("publicCatalogs").doc(organizationId).get();
  if (!catalogSnapshot.exists) return [];

  const raw = catalogSnapshot.data();
  const collections = Array.isArray(raw?.collections)
    ? raw.collections
    : [];
  return collections
    .map((entry) => {
      const slug = typeof entry?.slug === "string" ? slugifySegment(entry.slug) : "";
      const label = typeof entry?.label === "string" ? entry.label : "";
      const count =
        typeof entry?.count === "number" && Number.isFinite(entry.count) && entry.count >= 0
          ? Math.floor(entry.count)
          : 0;
      if (!slug || !label) return null;
      return { slug, label, count };
    })
    .filter((entry): entry is PublicCollectionSummary => entry !== null);
}

function buildListingCard(
  product: Product,
  canonicalOrgSlug: string,
  baseUrl: string,
): PublicProductListingCard {
  const canonicalProductSlug = slugifySegment(
    product.publicPage?.slugCanonical || product.publicPage?.slug || product.name,
  );
  const canonicalPath = buildCanonicalProductPath(canonicalOrgSlug, canonicalProductSlug);
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  const listingCard = product.publicPage?.listingCard;

  if (listingCard) {
    return {
      ...listingCard,
      canonicalPath,
      canonicalUrl,
      id: product.id,
      name: listingCard.name || product.name,
      price: typeof listingCard.price === "number" ? listingCard.price : product.price,
      currency: listingCard.currency || product.currency,
      image: listingCard.image || product.images?.[0],
      category: listingCard.category || product.category,
      createdAt: listingCard.createdAt || toIsoDate(product.createdAt),
      updatedAt: listingCard.updatedAt || toIsoDate(product.updatedAt),
    };
  }

  return buildPublicProductListingCard(product, canonicalPath, canonicalUrl);
}

function buildBaseBreadcrumb(canonicalOrgSlug: string): PublicBreadcrumbItem[] {
  return [
    { label: "Home", path: "/" },
    { label: "All Products", path: buildCanonicalOrgProductsPath(canonicalOrgSlug) },
  ];
}

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
      const rawCollectionSlug =
        typeof request.query.collectionSlug === "string" ? request.query.collectionSlug : "";
      const rawCursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
      const orgSlug = slugifySegment(rawOrgSlug);
      const productSlug = rawProductSlug ? slugifySegment(rawProductSlug) : "";
      const collectionSlug = rawCollectionSlug ? slugifySegment(rawCollectionSlug) : "";
      const pageKind: RequestedPageKind = rawProductSlug
        ? "product_detail"
        : rawCollectionSlug
          ? "collection_products"
          : "org_products";
      const cursor = parseCursor(rawCursor);

      if (!rawOrgSlug) {
        response.status(400).json({ error: "orgSlug query param is required" });
        return;
      }
      if (rawProductSlug && rawCollectionSlug) {
        response.status(400).json({ error: "Provide productSlug or collectionSlug, not both" });
        return;
      }
      if (rawCursor && !cursor) {
        response.status(400).json({ error: "Invalid cursor" });
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
      const locale = resolvePreferredLocale(request.get("accept-language") || undefined);
      const cache = getConfigCache();
      const cacheKey = [
        FUNCTION_NAME,
        pageKind,
        orgSlug,
        collectionSlug || "-",
        productSlug || "-",
        rawCursor || "-",
        locale,
        useJsonMode ? "json" : "http",
      ].join(":");
      const cached = cache.get<PublicCatalogResponse>(cacheKey);
      if (cached) {
        response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
        response.setHeader("Vary", "Accept-Language");
        response.setHeader("X-Cache", "HIT");
        if (cached.kind === "redirect" && !useJsonMode) {
          response.redirect(301, cached.canonicalUrl);
          return;
        }
        response.status(200).json(cached);
        return;
      }

      const organization = await getOrganizationBySlug(orgSlug);
      if (!organization || organization.status !== "active") {
        response.status(404).json({ error: "Public catalog not found" });
        return;
      }

      const canonicalOrgSlug = slugifySegment(
        organization.settings?.publicPages?.orgSlug || organization.name,
      );

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);
      const productMetafieldRepository = getProductMetafieldRepository(databaseService);
      const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);

      const brandSites = await brandSiteRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
      });
      const baseUrl = resolvePublicProductBaseUrl(organization, brandSites);
      const organizationPayload = buildOrganizationPayload(organization, canonicalOrgSlug);

      const db = getFirestore();
      let payload: PublicCatalogResponse;

      if (pageKind === "product_detail") {
        const productLookupSnapshot = await db
          .collection("products")
          .where("organizationId", "==", organization.id)
          .where("publicPage.slugLookup", "array-contains", productSlug)
          .limit(2)
          .get();

        const matchedProducts: Product[] = productLookupSnapshot.empty
          ? []
          : productLookupSnapshot.docs.map((entry) => snapshotToData<Product>(entry) as Product);
        if (matchedProducts.length === 0) {
          const fallbackProduct = await getProductBySlugFallback(
            organization.id,
            productSlug,
          );
          if (!fallbackProduct) {
            response.status(404).json({ error: "Public product page not found" });
            return;
          }
          matchedProducts.push(fallbackProduct);
        }

        const product =
          matchedProducts.find((entry) => entry.status === "active") ||
          matchedProducts[0];
        const canonicalProductSlug = slugifySegment(
          product.publicPage?.slugCanonical || product.publicPage?.slug || product.name,
        );
        const canonicalPath = buildCanonicalProductPath(canonicalOrgSlug, canonicalProductSlug);
        const canonicalUrl = `${baseUrl}${canonicalPath}`;

        if (
          canonicalOrgSlug !== orgSlug ||
          canonicalProductSlug !== productSlug ||
          rawProductSlug !== productSlug
        ) {
          payload = {
            kind: "redirect",
            canonicalPath,
            canonicalUrl,
          };
        } else {
          const collection = {
            slug: product.publicPage?.collectionSlug || resolvePublicCollection(product.category).slug,
            label: product.publicPage?.collectionLabel || resolvePublicCollection(product.category).label,
            path: buildCanonicalCollectionPath(
              canonicalOrgSlug,
              product.publicPage?.collectionSlug || resolvePublicCollection(product.category).slug,
            ),
          };

          if (product.status !== "active") {
            payload = {
              kind: "product_detail",
              canonicalPath,
              canonicalUrl,
              seo: {
                title: `${product.name} is unavailable`,
                description: "This product is currently unavailable.",
                canonicalUrl,
                robots: "index,follow",
              },
              organization: organizationPayload,
              breadcrumb: [
                ...buildBaseBreadcrumb(canonicalOrgSlug),
                { label: collection.label, path: collection.path },
                { label: product.name },
              ],
              product: {
                id: product.id,
                state: "unavailable",
              },
            };
          } else {
            let snapshot = product.publicPage?.detailSnapshot;
            if (!snapshot) {
              const metafields = await productMetafieldRepository.getAll({
                queryConstraints: [
                  { field: "organizationId", operator: "==", value: organization.id },
                  { field: "productId", operator: "==", value: product.id },
                ],
              });
              const definitions = await productMetafieldDefinitionRepository.getAll({
                queryConstraints: [{ field: "organizationId", operator: "==", value: organization.id }],
              });
              const computed = buildPublicProductSnapshot(product, metafields, definitions);
              snapshot = {
                fields: computed.fields,
                metafields: computed.metafields,
              };
            }
            const publicFields = {
              ...snapshot.fields,
              sku: undefined,
            };

            payload = {
              kind: "product_detail",
              canonicalPath,
              canonicalUrl,
              seo: {
                title: `${publicFields.name} · ${organization.name}`,
                description: publicFields.description || `View ${publicFields.name} details`,
                canonicalUrl,
                image: publicFields.images?.[0],
                robots: "index,follow",
              },
              organization: organizationPayload,
              breadcrumb: [
                ...buildBaseBreadcrumb(canonicalOrgSlug),
                { label: collection.label, path: collection.path },
                { label: publicFields.name },
              ],
              product: {
                id: product.id,
                state: "published",
                fields: publicFields,
                metafields: localizeMetafieldsForLocale(snapshot.metafields, locale),
                publicPage: {
                  version: product.publicPage?.version,
                  payloadHash: product.publicPage?.payloadHash,
                  lastPublishedAt: product.publicPage?.lastPublishedAt,
                },
              },
            };
          }
        }
      } else {
        const collections = buildCollectionNavigation(
          canonicalOrgSlug,
          await getCatalogCollections(organization.id),
        );

        if (pageKind === "org_products" && canonicalOrgSlug !== orgSlug) {
          const canonicalPath = buildCanonicalOrgProductsPath(canonicalOrgSlug);
          payload = {
            kind: "redirect",
            canonicalPath,
            canonicalUrl: `${baseUrl}${canonicalPath}`,
          };
        } else {
          const requestedCollectionSlug = pageKind === "collection_products" ? collectionSlug : undefined;
          const collectionFilter = requestedCollectionSlug || undefined;

          let query = db
            .collection("products")
            .where("organizationId", "==", organization.id)
            .where("status", "==", "active");

          if (collectionFilter) {
            query = query.where("publicPage.collectionSlug", "==", collectionFilter);
          }

          query = query
            .orderBy("createdAt", "desc")
            .orderBy(FieldPath.documentId(), "asc")
            .limit(PAGE_SIZE + 1);

          if (cursor) {
            query = query.startAfter(cursor.createdAt, cursor.id);
          }

          const listingSnapshot = await query.get();
          const listedProducts = listingSnapshot.docs.map((entry) => snapshotToData<Product>(entry));
          const hasMore = listedProducts.length > PAGE_SIZE;
          const pageProducts = hasMore ? listedProducts.slice(0, PAGE_SIZE) : listedProducts;
          const tail = pageProducts[pageProducts.length - 1];
          const nextCursor = hasMore && tail ? buildCursor(tail.createdAt, tail.id) : undefined;
          const listingItems = pageProducts.map((product) =>
            buildListingCard(product, canonicalOrgSlug, baseUrl),
          );

          if (pageKind === "collection_products") {
            const summary = collections.find((entry) => entry.slug === collectionSlug);
            const collectionLabel =
              summary?.label ||
              pageProducts[0]?.publicPage?.collectionLabel ||
              (collectionSlug === "uncategorized"
                ? "Uncategorized"
                : collectionSlug
                    .split("-")
                    .filter(Boolean)
                    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
                    .join(" "));

            const canonicalPath = buildCanonicalCollectionPath(canonicalOrgSlug, collectionSlug);
            const canonicalUrl = `${baseUrl}${canonicalPath}`;
            const shouldRedirect =
              canonicalOrgSlug !== orgSlug ||
              rawCollectionSlug !== collectionSlug;

            if (shouldRedirect) {
              payload = {
                kind: "redirect",
                canonicalPath,
                canonicalUrl,
              };
            } else {
              const collectionExists = Boolean(summary) || listingItems.length > 0 || collectionSlug === "uncategorized";
              if (!collectionExists) {
                response.status(404).json({ error: "Collection not found" });
                return;
              }
              payload = {
                kind: "collection_products",
                canonicalPath,
                canonicalUrl,
                seo: {
                  title: `${collectionLabel} · ${organization.name}`,
                  description: `Browse ${collectionLabel} products from ${organization.name}.`,
                  canonicalUrl,
                  image: listingItems[0]?.image,
                  robots: "index,follow",
                },
                organization: organizationPayload,
                breadcrumb: [
                  ...buildBaseBreadcrumb(canonicalOrgSlug),
                  { label: collectionLabel },
                ],
                collection: {
                  slug: collectionSlug,
                  label: collectionLabel,
                  path: canonicalPath,
                },
                collections,
                listing: {
                  items: listingItems,
                  pagination: {
                    limit: PAGE_SIZE,
                    hasMore,
                    nextCursor,
                  },
                },
              };
            }
          } else {
            const canonicalPath = buildCanonicalOrgProductsPath(canonicalOrgSlug);
            const canonicalUrl = `${baseUrl}${canonicalPath}`;
            payload = {
              kind: "org_products",
              canonicalPath,
              canonicalUrl,
              seo: {
                title: `${organization.name} · All Products`,
                description: `Browse all products from ${organization.name}.`,
                canonicalUrl,
                image: listingItems[0]?.image,
                robots: "index,follow",
              },
              organization: organizationPayload,
              breadcrumb: buildBaseBreadcrumb(canonicalOrgSlug),
              collections,
              listing: {
                items: listingItems,
                pagination: {
                  limit: PAGE_SIZE,
                  hasMore,
                  nextCursor,
                },
              },
            };
          }
        }
      }

      cache.set(cacheKey, payload, CACHE_SECONDS);
      response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      response.setHeader("Vary", "Accept-Language");
      response.setHeader("X-Cache", "MISS");
      if (payload.kind === "redirect" && !useJsonMode) {
        response.redirect(301, payload.canonicalUrl);
        return;
      }
      response.status(200).json(payload);
    } catch (error) {
      logger.error("Failed to resolve public catalog page", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: request.query,
      });
      response.status(500).json({ error: "Internal server error" });
    }
  },
);
