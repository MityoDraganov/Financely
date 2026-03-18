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

export type PublicMetafieldView = {
  definitionId: string;
  name: string;
  type: string;
  description?: string;
  value: unknown;
  displayValue: string;
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

export type QrPayloadBuildResult = {
  payload: string;
  mode: "hybrid" | "text-only";
  payloadHash: string;
  richPacket: string;
  plainText: string;
};

export function slugifySegment(value: string): string {
  const normalized = value
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

function toPublicPlainText(canonicalUrl: string, snapshot: PublicProductSnapshot): string {
  const lines: string[] = [];
  lines.push("Financely Product Card (Offline)");
  lines.push(`URL: ${canonicalUrl}`);
  lines.push("");
  lines.push(`Name: ${snapshot.fields.name}`);
  if (snapshot.fields.description) lines.push(`Description: ${snapshot.fields.description}`);
  lines.push(`Price: ${snapshot.fields.price} ${snapshot.fields.currency}`);
  if (snapshot.fields.category) lines.push(`Category: ${snapshot.fields.category}`);
  if (snapshot.fields.sku) lines.push(`SKU: ${snapshot.fields.sku}`);
  if (snapshot.fields.barcode) lines.push(`Barcode: ${snapshot.fields.barcode}`);

  if (snapshot.metafields.length > 0) {
    lines.push("");
    lines.push("Metafields:");
    for (const metafield of snapshot.metafields) {
      lines.push(`- ${metafield.name}: ${metafield.displayValue}`);
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
  const plainText = toPublicPlainText(canonicalUrl, snapshot);
  const richPacket = JSON.stringify({
    version: 1,
    kind: "financely.publicProduct",
    canonicalUrl,
    productId: snapshot.productId,
    organizationId: snapshot.organizationId,
    fields: snapshot.fields,
    metafields: snapshot.metafields,
  });

  const hybrid = `${canonicalUrl}\n\n[[FINANCELY_RICH_JSON]]\n${richPacket}\n\n[[FINANCELY_TEXT_FALLBACK]]\n${plainText}`;
  let payload = hybrid;
  let mode: "hybrid" | "text-only" = "hybrid";

  if (hybrid.length > HYBRID_QR_MAX_CHARS) {
    const compactText = truncateAtLineBoundaries(plainText, TEXT_QR_MAX_CHARS);
    payload = `${canonicalUrl}\n\n${compactText}`;
    mode = "text-only";
  }

  return {
    payload,
    mode,
    payloadHash: createHash("sha256").update(payload).digest("hex"),
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
