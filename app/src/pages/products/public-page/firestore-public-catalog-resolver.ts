import i18n from "@/i18n/config";
import type {
  MetafieldDefinition,
  Organization,
  Product,
  ProductMetafield,
} from "@/core";
import { firebase } from "@/infrastructure/firebase";
import { slugifyPublicSegment } from "@/utils/slug";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type {
  PublicCatalogResponse,
  PublicMultiCurrencyPair,
  PublicProductFields,
  PublicProductMetafield,
} from "./types";

type RequestedPageKind = "org_products" | "collection_products" | "product_detail";
type ListingCursor = {
  createdAt: string;
  id: string;
};
type CursorState = {
  createdAt: Date;
  id: string;
};
type PublicCollectionSummary = {
  slug: string;
  label: string;
  count: number;
};
type FirestoreQueryError = {
  code?: string;
  message?: string;
};

const PAGE_SIZE = 24;
const ORG_SLUG_SCAN_BATCH_SIZE = 200;
const ORG_SLUG_SCAN_MAX_DOCS = 4000;
const LISTING_FALLBACK_SCAN_BATCH_SIZE = 200;
const LISTING_FALLBACK_SCAN_MAX_DOCS = 4000;
const PRODUCT_FALLBACK_SCAN_BATCH_SIZE = 200;
const PRODUCT_FALLBACK_SCAN_MAX_DOCS = 2000;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

function normalizeCurrencyCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(normalized) ? normalized : null;
}

function getOrganizationBaseCurrency(organization: Organization): string {
  return (
    normalizeCurrencyCode(organization.settings?.defaultCurrency) ||
    normalizeCurrencyCode((organization.settings as { currency?: string } | undefined)?.currency) ||
    "USD"
  );
}

function getOrganizationCurrencyPairs(organization: Organization): PublicMultiCurrencyPair[] {
  const pairs: PublicMultiCurrencyPair[] = [];
  const seen = new Set<string>();

  const pushPair = (fromRaw: unknown, toRaw: unknown, rateRaw: unknown) => {
    const from = normalizeCurrencyCode(fromRaw);
    const to = normalizeCurrencyCode(toRaw);
    const rate = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);
    if (!from || !to || !Number.isFinite(rate) || rate <= 0 || from === to) return;

    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ from, to, rate });
  };

  for (const override of organization.settings?.currencyRates?.overrides || []) {
    pushPair(override?.from, override?.to, override?.rate);
  }

  // Backward compatibility with legacy multi-currency settings.
  for (const pair of organization.settings?.multiCurrency?.pairs || []) {
    pushPair(pair?.from, pair?.to, pair?.rate);
  }

  return pairs;
}

function mapDoc<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<T, "id">),
  } as T;
}

const slugifySegment = slugifyPublicSegment;

function buildCanonicalProductPath(orgSlug: string, productSlug: string): string {
  return `/p/${orgSlug}/${productSlug}`;
}

function buildCanonicalOrgProductsPath(orgSlug: string): string {
  return `/p/${orgSlug}`;
}

function buildCanonicalCollectionPath(orgSlug: string, collectionSlug: string): string {
  return `/p/${orgSlug}/c/${collectionSlug}`;
}

function resolvePublicCollection(category: string | undefined): {
  slug: string;
  label: string;
} {
  const normalized = category?.trim();
  if (!normalized) {
    return {
      slug: "uncategorized",
      label: "Uncategorized",
    };
  }

  return {
    slug: slugifySegment(normalized),
    label: normalized,
  };
}

function resolveProductCollection(product: Product): {
  slug: string;
  label: string;
} {
  const live = resolvePublicCollection(product.category);
  const hasLiveCategory = Boolean(product.category?.trim());
  if (hasLiveCategory) {
    return live;
  }

  const fallbackSlug = slugifySegment(product.publicPage?.collectionSlug || live.slug);
  return {
    slug: fallbackSlug || "uncategorized",
    label: product.publicPage?.collectionLabel || live.label,
  };
}

function toCompactSlug(value: string): string {
  return value.replace(/-/g, "");
}

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

function isProductAfterCursor(product: Product, cursor: CursorState): boolean {
  const productCreatedAt = getCreatedAtMillis(product.createdAt);
  const cursorCreatedAt = cursor.createdAt.getTime();

  if (productCreatedAt < cursorCreatedAt) return true;
  if (productCreatedAt > cursorCreatedAt) return false;
  return String(product.id || "") > cursor.id;
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return atob(`${normalized}${"=".repeat(paddingLength)}`);
}

function buildCursor(createdAt: unknown, id: string): string | undefined {
  const createdAtIso = toIsoDate(createdAt);
  if (!createdAtIso || !id) return undefined;

  const payload: ListingCursor = {
    createdAt: createdAtIso,
    id,
  };

  return encodeBase64Url(JSON.stringify(payload));
}

function parseCursor(raw: string | undefined): CursorState | null {
  if (!raw) return null;

  try {
    const decoded = decodeBase64Url(raw);
    const parsed = JSON.parse(decoded) as Partial<ListingCursor>;
    if (!parsed.createdAt || !parsed.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return {
      createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function isFirestoreIndexError(error: unknown): boolean {
  if (!error) return false;

  const typed = error as FirestoreQueryError;
  if (typed.code === "failed-precondition") return true;

  const message = (typed.message || String(error)).toLowerCase();
  return message.includes("requires an index") || message.includes("failed precondition");
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

async function getOrganizationBySlug(orgSlug: string): Promise<Organization | null> {
  const db = firebase.firestore;
  let organizationId: string | null = null;

  const byCanonicalSlug = await getDocs(
    query(
      collection(db, "publicCatalogs"),
      where("orgSlugCanonical", "==", orgSlug),
      limit(1),
    ),
  );
  if (!byCanonicalSlug.empty) {
    const entry = byCanonicalSlug.docs[0];
    const data = entry.data() as { organizationId?: string } | undefined;
    organizationId = data?.organizationId || entry.id;
  }

  if (!organizationId) {
    const byAlias = await getDocs(
      query(
        collection(db, "publicCatalogs"),
        where("orgSlugAliases", "array-contains", orgSlug),
        limit(1),
      ),
    );
    if (!byAlias.empty) {
      const entry = byAlias.docs[0];
      const data = entry.data() as { organizationId?: string } | undefined;
      organizationId = data?.organizationId || entry.id;
    }
  }

  if (!organizationId) {
    const expectedPathPrefix = `/p/${orgSlug}/`;
    let scanned = 0;
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

    while (scanned < ORG_SLUG_SCAN_MAX_DOCS && !organizationId) {
      const constraints: QueryConstraint[] = [
        where("status", "==", "active"),
        where("publicPage.state", "==", "published"),
        orderBy(documentId(), "asc"),
        limit(ORG_SLUG_SCAN_BATCH_SIZE),
      ];
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const snapshot = await getDocs(query(collection(db, "products"), ...constraints));
      if (snapshot.empty) break;

      for (const entry of snapshot.docs) {
        scanned += 1;
        const data = entry.data() as {
          organizationId?: unknown;
          publicPage?: { canonicalPath?: unknown };
        };
        const canonicalPath =
          typeof data.publicPage?.canonicalPath === "string"
            ? data.publicPage.canonicalPath
            : "";
        if (!canonicalPath.startsWith(expectedPathPrefix)) {
          if (scanned >= ORG_SLUG_SCAN_MAX_DOCS) break;
          continue;
        }
        organizationId =
          typeof data.organizationId === "string" && data.organizationId.length > 0
            ? data.organizationId
            : null;
        if (organizationId) break;
        if (scanned >= ORG_SLUG_SCAN_MAX_DOCS) break;
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < ORG_SLUG_SCAN_BATCH_SIZE) break;
    }
  }

  if (!organizationId) return null;

  const organizationSnapshot = await getDoc(doc(db, "organizations", organizationId));
  if (!organizationSnapshot.exists()) return null;

  const organization = {
    id: organizationSnapshot.id,
    ...(organizationSnapshot.data() as Omit<Organization, "id">),
  } as Organization;

  if (organization.status !== "active") return null;
  return organization;
}

async function getProductBySlugFallback(
  organizationId: string,
  requestedProductSlug: string,
): Promise<Product | null> {
  const db = firebase.firestore;
  const requestedCompactSlug = toCompactSlug(requestedProductSlug);
  let scanned = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  let firstMatch: Product | null = null;
  let firstActiveMatch: Product | null = null;

  while (scanned < PRODUCT_FALLBACK_SCAN_MAX_DOCS) {
    const constraints: QueryConstraint[] = [
      where("organizationId", "==", organizationId),
      where("status", "==", "active"),
      where("publicPage.state", "==", "published"),
      orderBy(documentId(), "asc"),
      limit(PRODUCT_FALLBACK_SCAN_BATCH_SIZE),
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const snapshot = await getDocs(query(collection(db, "products"), ...constraints));

    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scanned += 1;
      const product = mapDoc<Product>(entry);
      if (product.organizationId !== organizationId) {
        if (scanned >= PRODUCT_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

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
        return firstActiveMatch;
      }

      if (scanned >= PRODUCT_FALLBACK_SCAN_MAX_DOCS) break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PRODUCT_FALLBACK_SCAN_BATCH_SIZE) break;
  }

  return firstActiveMatch || firstMatch;
}

function parseCollectionSummaries(raw: unknown): PublicCollectionSummary[] {
  const collections = Array.isArray(raw) ? raw : [];

  return collections
    .map((entry) => {
      const typed = entry as {
        slug?: unknown;
        label?: unknown;
        count?: unknown;
      };

      const slug = typeof typed.slug === "string" ? slugifySegment(typed.slug) : "";
      const label = typeof typed.label === "string" ? typed.label : "";
      const count =
        typeof typed.count === "number" &&
        Number.isFinite(typed.count) &&
        typed.count >= 0
          ? Math.floor(typed.count)
          : 0;

      if (!slug || !label) return null;
      return { slug, label, count };
    })
    .filter((entry): entry is PublicCollectionSummary => entry !== null);
}

async function getCatalogCollections(organizationId: string): Promise<PublicCollectionSummary[]> {
  const db = firebase.firestore;

  try {
    const snapshot = await getDoc(doc(db, "publicCatalogs", organizationId));
    if (!snapshot.exists()) return [];
    const raw = snapshot.data();
    return parseCollectionSummaries(raw?.collections);
  } catch {
    return [];
  }
}

async function getLiveCollectionSummaries(
  organizationId: string,
): Promise<PublicCollectionSummary[]> {
  const db = firebase.firestore;
  const bySlug = new Map<string, { label: string; count: number }>();
  let scanned = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  while (scanned < LISTING_FALLBACK_SCAN_MAX_DOCS) {
    const constraints: QueryConstraint[] = [
      where("organizationId", "==", organizationId),
      where("status", "==", "active"),
      where("publicPage.state", "==", "published"),
      orderBy(documentId(), "asc"),
      limit(LISTING_FALLBACK_SCAN_BATCH_SIZE),
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const snapshot = await getDocs(query(collection(db, "products"), ...constraints));
    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scanned += 1;
      const product = mapDoc<Product>(entry);
      if (product.organizationId !== organizationId) {
        if (scanned >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

      const resolvedCollection = resolveProductCollection(product);
      if (!resolvedCollection.slug || resolvedCollection.slug === "uncategorized") {
        if (scanned >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }

      const existing = bySlug.get(resolvedCollection.slug);
      if (existing) {
        existing.count += 1;
        if (!existing.label && resolvedCollection.label) {
          existing.label = resolvedCollection.label;
        }
      } else {
        bySlug.set(resolvedCollection.slug, {
          label: resolvedCollection.label,
          count: 1,
        });
      }

      if (scanned >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < LISTING_FALLBACK_SCAN_BATCH_SIZE) break;
  }

  return Array.from(bySlug.entries())
    .map(([slug, entry]) => ({
      slug,
      label: entry.label || humanizeCollectionSlug(slug),
      count: entry.count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildCollectionNavigation(
  canonicalOrgSlug: string,
  collections: PublicCollectionSummary[],
): Array<{
  slug: string;
  label: string;
  count: number;
  path: string;
}> {
  const entries = collections.filter((entry) => entry.slug !== "uncategorized");

  return entries
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => ({
      slug: entry.slug,
      label: entry.label,
      count: entry.count,
      path: buildCanonicalCollectionPath(canonicalOrgSlug, entry.slug),
    }));
}

function buildListingCard(
  product: Product,
  canonicalOrgSlug: string,
  baseUrl: string,
  organizationBaseCurrency: string,
): {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  category?: string;
  canonicalPath: string;
  canonicalUrl: string;
  createdAt?: string;
  updatedAt?: string;
} {
  const canonicalProductSlug = slugifySegment(
    product.publicPage?.slugCanonical || product.publicPage?.slug || product.name,
  );
  const canonicalPath = buildCanonicalProductPath(canonicalOrgSlug, canonicalProductSlug);
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  const listingCard = product.publicPage?.listingCard;
  const resolvedCollection = resolveProductCollection(product);

  if (listingCard) {
    return {
      ...listingCard,
      canonicalPath,
      canonicalUrl,
      id: product.id,
      name: listingCard.name || product.name,
      price: typeof listingCard.price === "number" ? listingCard.price : product.price,
      currency: organizationBaseCurrency,
      image: listingCard.image || product.images?.[0],
      category: product.category || listingCard.category || resolvedCollection.label,
      createdAt: listingCard.createdAt || toIsoDate(product.createdAt),
      updatedAt: listingCard.updatedAt || toIsoDate(product.updatedAt),
    };
  }

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    currency: organizationBaseCurrency,
    image: product.images?.[0],
    category: product.category || resolvedCollection.label,
    canonicalPath,
    canonicalUrl,
    createdAt: toIsoDate(product.createdAt),
    updatedAt: toIsoDate(product.updatedAt),
  };
}

function buildBaseBreadcrumb(canonicalOrgSlug: string, locale: string): Array<{
  label: string;
  path?: string;
}> {
  const t = i18n.getFixedT(locale, "publicCatalog");
  return [
    { label: t("allProducts"), path: buildCanonicalOrgProductsPath(canonicalOrgSlug) },
  ];
}

function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
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

function localizeDateMetafieldDisplayValue(
  metafield: PublicProductMetafield,
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
  }

  return metafield.displayValue;
}

function localizeMetafieldsForLocale(
  metafields: PublicProductMetafield[],
  locale: string,
): PublicProductMetafield[] {
  return metafields.map((metafield) => {
    if (metafield.type !== "date") return metafield;
    if (metafield.dateDisplayMode !== "localized") return metafield;
    return {
      ...metafield,
      displayValue: localizeDateMetafieldDisplayValue(metafield, locale),
    };
  });
}

function formatMetafieldValue(
  value: unknown,
  definition: MetafieldDefinition,
): string {
  if (value === null || value === undefined) return "—";

  const selectOptions = definition.options?.selectOptions || [];
  if (definition.type === "single_line_text_field_choice_list" && typeof value === "string") {
    const option = selectOptions.find((entry) => entry.value === value);
    return option?.label || value;
  }

  if (definition.type.startsWith("list.")) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(", ");
    }
    return String(value);
  }

  if (definition.type === "boolean") {
    return value === true ? "Yes" : "No";
  }

  if (definition.type === "json") {
    return JSON.stringify(value);
  }

  if (definition.type === "date" && typeof value === "string") {
    return value.replace("..", " - ");
  }

  if (definition.type === "date_time" && typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return String(value);
}

function buildPublicMetafields(
  metafields: ProductMetafield[],
  definitions: MetafieldDefinition[],
): PublicProductMetafield[] {
  const visibleDefinitions = new Map<string, MetafieldDefinition>();
  for (const definition of definitions) {
    if (definition.options?.publicVisible === true) {
      visibleDefinitions.set(definition.id, definition);
    }
  }

  const visibleMetafields: PublicProductMetafield[] = [];
  for (const metafield of metafields) {
    const definition = visibleDefinitions.get(metafield.definitionId);
    if (!definition) continue;

    visibleMetafields.push({
      definitionId: definition.id,
      name: definition.label || definition.name,
      type: definition.type,
      description: definition.description,
      value: metafield.value,
      displayValue: formatMetafieldValue(metafield.value, definition),
      dateDisplayMode:
        definition.type === "date"
          ? definition.options?.dateConfig?.displayMode || "numeric"
          : undefined,
    });
  }

  return visibleMetafields;
}

async function fetchLiveProductMetafields(
  organizationId: string,
  productId: string,
): Promise<PublicProductMetafield[]> {
  const db = firebase.firestore;
  const definitionsSnapshot = await getDocs(
    query(
      collection(db, "productMetafieldDefinitions"),
      where("organizationId", "==", organizationId),
      where("options.publicVisible", "==", true),
    ),
  );
  const definitions = definitionsSnapshot.docs.map((entry) => mapDoc<MetafieldDefinition>(entry));
  if (definitions.length === 0) return [];

  const metafieldSnapshots = await Promise.all(
    definitions.map((definition) =>
      getDocs(
        query(
          collection(db, "productMetafields"),
          where("organizationId", "==", organizationId),
          where("productId", "==", productId),
          where("definitionId", "==", definition.id),
        ),
      ),
    ),
  );

  const metafields = metafieldSnapshots.flatMap((snapshot) =>
    snapshot.docs.map((entry) => mapDoc<ProductMetafield>(entry)),
  );

  return buildPublicMetafields(metafields, definitions);
}

function buildFallbackPublicProductFields(
  product: Product,
  organizationBaseCurrency: string,
): PublicProductFields {
  return {
    name: product.name,
    description: product.description,
    price: product.price,
    currency: organizationBaseCurrency,
    barcode: product.barcode,
    category: product.category,
    tags: product.tags || [],
    images: product.images || [],
    taxRate: product.taxRate,
    weight: product.weight,
    dimensions: product.dimensions,
  };
}

type ListingResult = {
  products: Product[];
  hasMore: boolean;
  nextCursor?: string;
};

function buildListingResult(
  products: Product[],
  pageSize: number,
): ListingResult {
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

function resolveProductCollectionSlug(product: Product): string {
  return slugifySegment(resolveProductCollection(product).slug);
}

async function getListingProductsWithFallback(params: {
  organizationId: string;
  collectionFilter?: string;
  cursor: CursorState | null;
  pageSize: number;
}): Promise<ListingResult> {
  const { organizationId, collectionFilter, cursor, pageSize } = params;
  const db = firebase.firestore;

  if (!collectionFilter) {
    try {
      const constraints: QueryConstraint[] = [
        where("organizationId", "==", organizationId),
        where("status", "==", "active"),
        where("publicPage.state", "==", "published"),
      ];
      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(orderBy(documentId(), "asc"));
      constraints.push(limit(pageSize + 1));
      if (cursor) {
        constraints.push(startAfter(cursor.createdAt, cursor.id));
      }

      const snapshot = await getDocs(query(collection(db, "products"), ...constraints));
      const listedProducts = snapshot.docs.map((entry) => mapDoc<Product>(entry));
      return buildListingResult(listedProducts, pageSize);
    } catch (error) {
      if (!isFirestoreIndexError(error)) {
        throw error;
      }
    }
  }

  const scannedProducts: Product[] = [];
  let scannedCount = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  while (scannedCount < LISTING_FALLBACK_SCAN_MAX_DOCS) {
    const constraints: QueryConstraint[] = [
      where("organizationId", "==", organizationId),
      where("status", "==", "active"),
      where("publicPage.state", "==", "published"),
      orderBy(documentId(), "asc"),
      limit(LISTING_FALLBACK_SCAN_BATCH_SIZE),
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const snapshot = await getDocs(query(collection(db, "products"), ...constraints));
    if (snapshot.empty) break;

    for (const entry of snapshot.docs) {
      scannedCount += 1;
      const product = mapDoc<Product>(entry);
      if (product.organizationId !== organizationId) {
        if (scannedCount >= LISTING_FALLBACK_SCAN_MAX_DOCS) break;
        continue;
      }
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

  return buildListingResult(paged.slice(0, pageSize + 1), pageSize);
}

function humanizeCollectionSlug(collectionSlug: string): string {
  if (collectionSlug === "uncategorized") return "Uncategorized";
  return collectionSlug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export async function resolvePublicCatalogPage(params: {
  orgSlug: string;
  productSlug?: string;
  collectionSlug?: string;
  cursor?: string;
  locale?: string;
}): Promise<PublicCatalogResponse> {
  const rawOrgSlug = params.orgSlug.trim();
  const rawProductSlug = params.productSlug?.trim() || "";
  const rawCollectionSlug = params.collectionSlug?.trim() || "";
  const rawCursor = params.cursor;

  if (!rawOrgSlug) {
    throw new Error("orgSlug query param is required");
  }
  if (rawProductSlug && rawCollectionSlug) {
    throw new Error("Provide productSlug or collectionSlug, not both");
  }

  const orgSlug = slugifySegment(rawOrgSlug);
  const productSlug = rawProductSlug ? slugifySegment(rawProductSlug) : "";
  const collectionSlug = rawCollectionSlug ? slugifySegment(rawCollectionSlug) : "";
  const pageKind: RequestedPageKind = rawProductSlug
    ? "product_detail"
    : rawCollectionSlug
      ? "collection_products"
      : "org_products";
  const cursor = parseCursor(rawCursor);
  if (rawCursor && !cursor) {
    throw new Error("Invalid cursor");
  }

  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization || organization.status !== "active") {
    throw new Error("Public catalog not found");
  }

  const locale = organization.settings?.defaultLanguage || params.locale || "en";
  const organizationBaseCurrency = getOrganizationBaseCurrency(organization);
  const organizationCurrencyPairs = getOrganizationCurrencyPairs(organization);

  const canonicalOrgSlug = slugifySegment(
    organization.settings?.publicPages?.orgSlug || organization.name,
  );
  const baseUrl = getAppBaseUrl();
  const organizationPayload = {
    id: organization.id,
    name: organization.name,
    orgSlug: canonicalOrgSlug,
    baseCurrency: organizationBaseCurrency,
    logoUrl: organization.settings?.branding?.customLogo || organization.logoUrl,
    locale,
    multiCurrency:
      organizationCurrencyPairs.length > 0
        ? {
            enabled: true,
            pairs: organizationCurrencyPairs,
          }
        : undefined,
  };

  if (pageKind === "product_detail") {
    const db = firebase.firestore;
    let matchedProducts: Product[] = [];

    try {
      const productLookupSnapshot = await getDocs(
        query(
          collection(db, "products"),
          where("organizationId", "==", organization.id),
          where("status", "==", "active"),
          where("publicPage.state", "==", "published"),
          where("publicPage.slugLookup", "array-contains", productSlug),
          limit(2),
        ),
      );
      matchedProducts = productLookupSnapshot.docs.map((entry) => mapDoc<Product>(entry));
    } catch (error) {
      if (!isFirestoreIndexError(error)) {
        throw error;
      }
    }

    if (matchedProducts.length === 0) {
      const fallbackProduct = await getProductBySlugFallback(organization.id, productSlug);
      if (!fallbackProduct) {
        throw new Error("Public product page not found");
      }
      matchedProducts = [fallbackProduct];
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
      return {
        kind: "redirect",
        canonicalPath,
        canonicalUrl,
      };
    }

    const resolvedCollection = resolveProductCollection(product);
    const collectionSlugRaw = resolvedCollection.slug;
    const collectionData =
      collectionSlugRaw === "uncategorized"
        ? null
        : {
            slug: collectionSlugRaw,
            label: resolvedCollection.label,
            path: buildCanonicalCollectionPath(canonicalOrgSlug, collectionSlugRaw),
          };

    if (product.status !== "active") {
      return {
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
          ...buildBaseBreadcrumb(canonicalOrgSlug, locale),
          ...(collectionData && collectionData.label !== product.name ? [{ label: collectionData.label, path: collectionData.path }] : []),
          { label: product.name },
        ],
        product: {
          id: product.id,
          state: "unavailable",
        },
      };
    }

    const snapshot = product.publicPage?.detailSnapshot;
    const publicFields = {
      ...(snapshot?.fields ||
        buildFallbackPublicProductFields(product, organizationBaseCurrency)),
      sku: undefined,
    };
    let metafields = snapshot?.metafields || [];
    try {
      const liveMetafields = await fetchLiveProductMetafields(
        organization.id,
        product.id,
      );
      if (liveMetafields.length > 0 || metafields.length === 0) {
        metafields = liveMetafields;
      }
    } catch {
      // Keep snapshot metafields when live reads are unavailable.
    }
    const localizedMetafields = localizeMetafieldsForLocale(metafields, locale);

    return {
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
        ...buildBaseBreadcrumb(canonicalOrgSlug, locale),
        ...(collectionData && collectionData.label !== publicFields.name ? [{ label: collectionData.label, path: collectionData.path }] : []),
        { label: publicFields.name },
      ],
      product: {
        id: product.id,
        state: "published",
        fields: publicFields,
        metafields: localizedMetafields,
      },
    };
  }

  const liveCollections = await getLiveCollectionSummaries(organization.id);
  const catalogIndexCollections =
    liveCollections.length === 0 ? await getCatalogCollections(organization.id) : [];
  const collections = buildCollectionNavigation(
    canonicalOrgSlug,
    liveCollections.length > 0 ? liveCollections : catalogIndexCollections,
  );

  if (pageKind === "org_products" && canonicalOrgSlug !== orgSlug) {
    const canonicalPath = buildCanonicalOrgProductsPath(canonicalOrgSlug);
    return {
      kind: "redirect",
      canonicalPath,
      canonicalUrl: `${baseUrl}${canonicalPath}`,
    };
  }

  const requestedCollectionSlug = pageKind === "collection_products" ? collectionSlug : undefined;
  const listingResult = await getListingProductsWithFallback({
    organizationId: organization.id,
    collectionFilter: requestedCollectionSlug || undefined,
    cursor,
    pageSize: PAGE_SIZE,
  });
  const listingItems = listingResult.products.map((product) =>
    buildListingCard(
      product,
      canonicalOrgSlug,
      baseUrl,
      organizationBaseCurrency,
    ),
  );

  if (pageKind === "collection_products") {
    const summary = collections.find((entry) => entry.slug === collectionSlug);
    const collectionLabel =
      summary?.label ||
      (listingResult.products[0]
        ? resolveProductCollection(listingResult.products[0]).label
        : undefined) ||
      humanizeCollectionSlug(collectionSlug);
    const canonicalPath = buildCanonicalCollectionPath(canonicalOrgSlug, collectionSlug);
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    const shouldRedirect =
      canonicalOrgSlug !== orgSlug || rawCollectionSlug !== collectionSlug;
    if (shouldRedirect) {
      return {
        kind: "redirect",
        canonicalPath,
        canonicalUrl,
      };
    }

    const collectionExists = Boolean(summary) || listingItems.length > 0;
    if (!collectionExists) {
      throw new Error("Collection not found");
    }

    return {
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
      breadcrumb: [...buildBaseBreadcrumb(canonicalOrgSlug, locale), { label: collectionLabel }],
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
          hasMore: listingResult.hasMore,
          nextCursor: listingResult.nextCursor,
        },
      },
    };
  }

  const canonicalPath = buildCanonicalOrgProductsPath(canonicalOrgSlug);
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  return {
    kind: "org_products",
    canonicalPath,
    canonicalUrl,
    seo: {
      title: `${organization.name} · ${i18n.getFixedT(locale, "publicCatalog")("allProducts")}`,
      description: `Browse all products from ${organization.name}.`,
      canonicalUrl,
      image: listingItems[0]?.image,
      robots: "index,follow",
    },
    organization: organizationPayload,
    breadcrumb: buildBaseBreadcrumb(canonicalOrgSlug, locale),
    collections,
    listing: {
      items: listingItems,
      pagination: {
        limit: PAGE_SIZE,
        hasMore: listingResult.hasMore,
        nextCursor: listingResult.nextCursor,
      },
    },
  };
}
