import { createHash } from "crypto";
import { getStorage } from "firebase-admin/storage";
import { getAppOrigin } from "../config/app-url";
import { BrandSite } from "../core/entities/brand-site";
import { MetafieldDefinition } from "../core/entities/metafield";
import { Organization } from "../core/entities/organization";
import { Product } from "../core/entities/product";
import { ProductMetafield } from "../core/entities/product-metafield";

const HYBRID_QR_MAX_CHARS = 2200;
const TEXT_QR_MAX_CHARS = 1800;
export const PUBLIC_PRODUCT_QR_PACKET_VERSION = 3;
const OFFLINE_PACKET_MARKER = `FINANCELY_PUBLIC_PRODUCT_PACKET_V${PUBLIC_PRODUCT_QR_PACKET_VERSION}`;
const ABSOLUTE_URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;

export type PublicMetafieldView = {
  definitionId: string;
  name: string;
  type: string;
  description?: string;
  value: unknown;
  displayValue: string;
  dateDisplayMode?: "numeric" | "localized";
};

export type PublicProductFields = {
  name: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  barcode?: string;
  category?: string;
  tags?: string[];
  images?: string[];
  taxRate?: number;
  weight?: number;
  dimensions?: Product["dimensions"];
};

export type PublicProductSnapshot = {
  productId: string;
  organizationId: string;
  fields: PublicProductFields;
  metafields: PublicMetafieldView[];
};

export type PublicCollectionSummary = {
  slug: string;
  label: string;
  count: number;
};

export type PublicProductListingCard = {
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
};

export type QrPayloadBuildResult = {
  payload: string;
  mode: "hybrid" | "text-only";
  payloadHash: string;
  packetVersion: number;
  richPacket: string;
  plainText: string;
};

export function slugifySegment(value: unknown): string {
  const input =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";

  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "item";
}

export function normalizeSlugAliases(
  aliases: string[] | undefined,
  currentSlug: string,
): string[] {
  const deduped = new Set<string>();
  for (const alias of aliases || []) {
    const normalized = slugifySegment(alias);
    if (!normalized || normalized === currentSlug) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped).sort();
}

export function buildCanonicalProductPath(orgSlug: string, productSlug: string): string {
  return `/p/${orgSlug}/${productSlug}`;
}

export function buildCanonicalOrgProductsPath(orgSlug: string): string {
  return `/p/${orgSlug}`;
}

export function buildCanonicalCollectionPath(orgSlug: string, collectionSlug: string): string {
  return `/p/${orgSlug}/c/${collectionSlug}`;
}

export function getAppBaseUrl(): string {
  return getAppOrigin();
}

function extractDomainFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pickPrimaryBrandSite(brandSites: BrandSite[]): BrandSite | null {
  if (brandSites.length === 0) return null;
  const sorted = [...brandSites].sort((a, b) => {
    const aHasPrimary = a.primaryDomain ? 1 : 0;
    const bHasPrimary = b.primaryDomain ? 1 : 0;
    if (aHasPrimary !== bHasPrimary) return bHasPrimary - aHasPrimary;

    const aUpdated = a.updatedAt ? new Date(String(a.updatedAt)).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(String(b.updatedAt)).getTime() : 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    return a.id.localeCompare(b.id);
  });
  return sorted[0] || null;
}

export function resolvePublicProductBaseUrl(
  organization: Organization,
  brandSites: BrandSite[],
): string {
  const preference = organization.settings?.publicPages?.domainPreference || "custom-first";
  const primarySite = pickPrimaryBrandSite(
    brandSites.filter((site) => site.organizationId === organization.id && site.status === "success"),
  );

  if (preference === "custom-first" && primarySite) {
    const customDomain =
      primarySite.primaryDomain ||
      primarySite.customDomain ||
      extractDomainFromUrl(primarySite.deployedUrl);
    if (customDomain) return `https://${customDomain}`;
  }

  return getAppBaseUrl();
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    next[key] = entry;
  }
  return next as T;
}

function formatMetafieldValue(value: unknown, definition: MetafieldDefinition): string {
  if (value === null || value === undefined) return "—";

  const selectOptions = definition.options?.selectOptions || [];
  if (definition.type === "single_line_text_field_choice_list" && typeof value === "string") {
    const option = selectOptions.find((entry) => entry.value === value);
    return option?.label || value;
  }

  if (definition.type.startsWith("list.")) {
    if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
    return String(value);
  }

  if (definition.type === "boolean") return value === true ? "Yes" : "No";

  if (definition.type === "json") return JSON.stringify(value);

  if (definition.type === "date" && typeof value === "string") {
    return value.replace("..", " - ");
  }

  if (definition.type === "date_time" && typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return String(value);
}

export function buildPublicProductSnapshot(
  product: Product,
  metafields: ProductMetafield[],
  definitions: MetafieldDefinition[],
): PublicProductSnapshot {
  const visibleDefinitions = new Map<string, MetafieldDefinition>();
  for (const definition of definitions) {
    if (definition.options?.publicVisible === true) {
      visibleDefinitions.set(definition.id, definition);
    }
  }

  const visibleMetafields: PublicMetafieldView[] = [];
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
      dateDisplayMode: definition.type === "date"
        ? definition.options?.dateConfig?.displayMode || "numeric"
        : undefined,
    });
  }

  const fields = compactObject<PublicProductFields>({
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category,
    tags: product.tags || [],
    images: product.images || [],
    taxRate: product.taxRate,
    weight: product.weight,
    dimensions: product.dimensions,
  });

  return {
    productId: product.id,
    organizationId: product.organizationId,
    fields,
    metafields: visibleMetafields,
  };
}

export function resolvePublicCollection(category: string | undefined): {
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

export function buildSlugLookup(slugCanonical: string, slugAliases: string[]): string[] {
  const deduped = new Set<string>();
  const canonical = slugifySegment(slugCanonical);
  if (canonical) deduped.add(canonical);
  for (const alias of slugAliases) {
    const normalized = slugifySegment(alias);
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

export function buildCollectionSummaries(
  products: Array<Pick<Product, "status" | "category" | "publicPage">>,
): PublicCollectionSummary[] {
  const bySlug = new Map<string, { label: string; count: number }>();
  for (const product of products) {
    if (product.status !== "active") continue;
    const fallback = resolvePublicCollection(product.category);
    const slug = slugifySegment(product.publicPage?.collectionSlug || fallback.slug);
    if (slug === "uncategorized") continue;
    const label = product.publicPage?.collectionLabel || fallback.label;
    const existing = bySlug.get(slug);
    if (existing) {
      existing.count += 1;
      continue;
    }
    bySlug.set(slug, { label, count: 1 });
  }

  return Array.from(bySlug.entries())
    .map(([slug, entry]) => ({
      slug,
      label: entry.label,
      count: entry.count,
    }))
    .sort((a, b) => {
      if (a.slug === "uncategorized" && b.slug !== "uncategorized") return 1;
      if (b.slug === "uncategorized" && a.slug !== "uncategorized") return -1;
      return a.label.localeCompare(b.label);
    });
}

export function buildPublicProductListingCard(
  product: Product,
  canonicalPath: string,
  canonicalUrl: string,
): PublicProductListingCard {
  const createdAtRaw = product.createdAt as unknown;
  const updatedAtRaw = product.updatedAt as unknown;
  return compactObject<PublicProductListingCard>({
    id: product.id,
    name: product.name,
    price: product.price,
    currency: product.currency,
    image: product.images?.[0],
    category: product.category,
    canonicalPath,
    canonicalUrl,
    createdAt: typeof createdAtRaw === "string"
      ? createdAtRaw
      : createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : undefined,
    updatedAt: typeof updatedAtRaw === "string"
      ? updatedAtRaw
      : updatedAtRaw instanceof Date
        ? updatedAtRaw.toISOString()
        : undefined,
  });
}

function parseCanonicalLocation(canonicalUrl: string): { host: string; path: string } {
  try {
    const parsed = new URL(canonicalUrl);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return {
      host: parsed.host,
      path: path || "/",
    };
  } catch {
    const withoutScheme = canonicalUrl.replace(/^https?:\/\//i, "");
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash === -1) {
      return { host: withoutScheme, path: "/" };
    }

    const host = withoutScheme.slice(0, firstSlash);
    const path = withoutScheme.slice(firstSlash) || "/";
    return { host, path };
  }
}

function defangAbsoluteUrl(url: string): string {
  const withoutScheme = url.replace(/^https?:\/\//i, "");
  const cleaned = withoutScheme.replace(/\/+$/g, "");
  return cleaned.replace(/\./g, "[.]").replace(/\//g, " / ");
}

function sanitizeTextForQr(value: string): string {
  return value.replace(ABSOLUTE_URL_PATTERN, (match) => `[link ${defangAbsoluteUrl(match)}]`);
}

function splitHostLabels(host: string): string[] {
  return host
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toPublicPlainText(canonicalUrl: string, snapshot: PublicProductSnapshot): string {
  const location = parseCanonicalLocation(canonicalUrl);
  const hostLabels = splitHostLabels(location.host);
  const lines: string[] = [];
  lines.push("Financely Product Card (Offline)");
  lines.push("Online page reference (manual entry when online):");
  if (hostLabels.length > 0) lines.push(`- Host labels: ${hostLabels.join(" / ")}`);
  lines.push(`- Path: ${location.path}`);
  lines.push("");
  lines.push(`Name: ${sanitizeTextForQr(snapshot.fields.name)}`);
  if (snapshot.fields.description) lines.push(`Description: ${sanitizeTextForQr(snapshot.fields.description)}`);
  lines.push(`Price: ${snapshot.fields.price} ${sanitizeTextForQr(snapshot.fields.currency)}`);
  if (snapshot.fields.category) lines.push(`Category: ${sanitizeTextForQr(snapshot.fields.category)}`);
  if (snapshot.fields.sku) lines.push(`SKU: ${sanitizeTextForQr(snapshot.fields.sku)}`);
  if (snapshot.fields.barcode) lines.push(`Barcode: ${sanitizeTextForQr(snapshot.fields.barcode)}`);

  if (snapshot.metafields.length > 0) {
    lines.push("");
    lines.push("Metafields:");
    for (const metafield of snapshot.metafields) {
      lines.push(`- ${sanitizeTextForQr(metafield.name)}: ${sanitizeTextForQr(metafield.displayValue)}`);
    }
  }

  return lines.join("\n");
}

function truncateAtLineBoundaries(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  const chunks = input.split("\n");
  const next: string[] = [];
  for (const chunk of chunks) {
    const candidate = [...next, chunk].join("\n");
    if (candidate.length > maxChars) break;
    next.push(chunk);
  }
  return `${next.join("\n")}\n...`;
}

export function buildQrPayload(
  canonicalUrl: string,
  snapshot: PublicProductSnapshot,
): QrPayloadBuildResult {
  const location = parseCanonicalLocation(canonicalUrl);
  const hostLabels = splitHostLabels(location.host);
  const plainText = toPublicPlainText(canonicalUrl, snapshot);
  const safeFields = compactObject({
    name: sanitizeTextForQr(snapshot.fields.name),
    description: snapshot.fields.description ? sanitizeTextForQr(snapshot.fields.description) : undefined,
    price: snapshot.fields.price,
    currency: sanitizeTextForQr(snapshot.fields.currency),
    sku: snapshot.fields.sku ? sanitizeTextForQr(snapshot.fields.sku) : undefined,
    barcode: snapshot.fields.barcode ? sanitizeTextForQr(snapshot.fields.barcode) : undefined,
    category: snapshot.fields.category ? sanitizeTextForQr(snapshot.fields.category) : undefined,
    tags: snapshot.fields.tags?.map((tag) => sanitizeTextForQr(tag)),
    taxRate: snapshot.fields.taxRate,
    weight: snapshot.fields.weight,
    dimensions: snapshot.fields.dimensions,
  });
  const safeMetafields = snapshot.metafields.map((metafield) =>
    compactObject({
      definitionId: metafield.definitionId,
      name: sanitizeTextForQr(metafield.name),
      type: metafield.type,
      description: metafield.description ? sanitizeTextForQr(metafield.description) : undefined,
      displayValue: sanitizeTextForQr(metafield.displayValue),
    }),
  );
  const richPacket = JSON.stringify({
    version: PUBLIC_PRODUCT_QR_PACKET_VERSION,
    kind: "financely.publicProduct",
    canonicalRoute: {
      hostLabels,
      path: location.path,
    },
    productId: snapshot.productId,
    organizationId: snapshot.organizationId,
    fields: safeFields,
    metafields: safeMetafields,
  });

  const hybrid = `${OFFLINE_PACKET_MARKER}\n\n${plainText}\n\n[[FINANCELY_RICH_JSON]]\n${richPacket}`;
  let payload = hybrid;
  let mode: "hybrid" | "text-only" = "hybrid";

  if (hybrid.length > HYBRID_QR_MAX_CHARS) {
    const compactText = truncateAtLineBoundaries(plainText, TEXT_QR_MAX_CHARS);
    payload = `${OFFLINE_PACKET_MARKER}\n\n${compactText}`;
    mode = "text-only";
  }

  return {
    payload,
    mode,
    payloadHash: createHash("sha256").update(payload).digest("hex"),
    packetVersion: PUBLIC_PRODUCT_QR_PACKET_VERSION,
    richPacket,
    plainText,
  };
}

export async function generateQrPngBuffer(payload: string): Promise<Buffer> {
  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", "768x768");
  qrUrl.searchParams.set("ecc", "M");
  qrUrl.searchParams.set("format", "png");
  qrUrl.searchParams.set("qzone", "1");
  qrUrl.searchParams.set("data", payload);

  const response = await fetch(qrUrl.toString());
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`QR generation failed: ${response.status} ${details}`.trim());
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("QR generation returned empty response");
  }
  return buffer;
}

export async function storePublicQrAsset(
  storagePath: string,
  payload: string,
): Promise<string> {
  const qrPng = await generateQrPngBuffer(payload);
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(qrPng, {
    metadata: {
      contentType: "image/png",
      metadata: {
        generatedAt: new Date().toISOString(),
      },
      cacheControl: "public,max-age=86400",
    },
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
