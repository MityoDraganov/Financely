const HYBRID_QR_MAX_CHARS = 2200;
const TEXT_QR_MAX_CHARS = 1800;
export const PUBLIC_PRODUCT_QR_PACKET_VERSION = 3;
const OFFLINE_PACKET_MARKER = `FINANCELY_PUBLIC_PRODUCT_PACKET_V${PUBLIC_PRODUCT_QR_PACKET_VERSION}`;
const ABSOLUTE_URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;

export type PublicProductQrFields = {
  name: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  barcode?: string;
  category?: string;
  tags?: string[];
  taxRate?: number;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: "cm" | "in" | "m";
  };
};

export type PublicProductQrMetafield = {
  definitionId: string;
  name: string;
  type?: string;
  description?: string;
  displayValue: string;
};

export type BuildPublicProductQrPayloadInput = {
  canonicalUrl: string;
  productId: string;
  organizationId: string;
  fields: PublicProductQrFields;
  metafields: PublicProductQrMetafield[];
  variant?: "compact" | "full";
};

export type BuildPublicProductQrPayloadResult = {
  payload: string;
  mode: "hybrid" | "text-only";
  packetVersion: number;
};

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    next[key] = entry;
  }
  return next as T;
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

function splitHostLabels(host: string): string[] {
  return host
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function defangAbsoluteUrl(url: string): string {
  const withoutScheme = url.replace(/^https?:\/\//i, "");
  const cleaned = withoutScheme.replace(/\/+$/g, "");
  return cleaned.replace(/\./g, "[.]").replace(/\//g, " / ");
}

function sanitizeTextForQr(value: string): string {
  return value.replace(ABSOLUTE_URL_PATTERN, (match) => `[link ${defangAbsoluteUrl(match)}]`);
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

function truncateInline(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`;
}

function buildPlainText(canonicalUrl: string, fields: PublicProductQrFields, metafields: PublicProductQrMetafield[]): string {
  const location = parseCanonicalLocation(canonicalUrl);
  const hostLabels = splitHostLabels(location.host);
  const lines: string[] = [];
  lines.push("Financely Product Card (Offline)");
  lines.push("Online page reference (manual entry when online):");
  if (hostLabels.length > 0) lines.push(`- Host labels: ${hostLabels.join(" / ")}`);
  lines.push(`- Path: ${location.path}`);
  lines.push("");
  lines.push(`Name: ${sanitizeTextForQr(fields.name)}`);
  if (fields.description) lines.push(`Description: ${sanitizeTextForQr(fields.description)}`);
  lines.push(`Price: ${fields.price} ${sanitizeTextForQr(fields.currency)}`);
  if (fields.category) lines.push(`Category: ${sanitizeTextForQr(fields.category)}`);
  if (fields.sku) lines.push(`SKU: ${sanitizeTextForQr(fields.sku)}`);
  if (fields.barcode) lines.push(`Barcode: ${sanitizeTextForQr(fields.barcode)}`);

  if (metafields.length > 0) {
    lines.push("");
    lines.push("Metafields:");
    for (const metafield of metafields) {
      lines.push(`- ${sanitizeTextForQr(metafield.name)}: ${sanitizeTextForQr(metafield.displayValue)}`);
    }
  }

  return lines.join("\n");
}

function buildCompactPlainText(canonicalUrl: string, fields: PublicProductQrFields, metafields: PublicProductQrMetafield[]): string {
  const location = parseCanonicalLocation(canonicalUrl);
  const hostLabels = splitHostLabels(location.host);
  const lines: string[] = [];
  lines.push("Financely Product Card (Offline, Compact)");
  if (hostLabels.length > 0) lines.push(`Host: ${hostLabels.join(" / ")}`);
  lines.push(`Path: ${location.path}`);
  lines.push(`Name: ${truncateInline(sanitizeTextForQr(fields.name), 90)}`);
  lines.push(`Price: ${fields.price} ${sanitizeTextForQr(fields.currency)}`);
  if (fields.category) lines.push(`Category: ${truncateInline(sanitizeTextForQr(fields.category), 48)}`);
  if (fields.sku) lines.push(`SKU: ${truncateInline(sanitizeTextForQr(fields.sku), 48)}`);

  const topMetafields = metafields.slice(0, 3);
  if (topMetafields.length > 0) {
    lines.push("Key details:");
    for (const metafield of topMetafields) {
      const key = truncateInline(sanitizeTextForQr(metafield.name), 32);
      const value = truncateInline(sanitizeTextForQr(metafield.displayValue), 60);
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

export function buildPublicProductQrPayload(
  input: BuildPublicProductQrPayloadInput,
): BuildPublicProductQrPayloadResult {
  if (input.variant === "compact") {
    const compactText = buildCompactPlainText(input.canonicalUrl, input.fields, input.metafields);
    return {
      payload: `${OFFLINE_PACKET_MARKER}\n\n${compactText}`,
      mode: "text-only",
      packetVersion: PUBLIC_PRODUCT_QR_PACKET_VERSION,
    };
  }

  const location = parseCanonicalLocation(input.canonicalUrl);
  const hostLabels = splitHostLabels(location.host);
  const plainText = buildPlainText(input.canonicalUrl, input.fields, input.metafields);
  const safeFields = compactObject({
    name: sanitizeTextForQr(input.fields.name),
    description: input.fields.description ? sanitizeTextForQr(input.fields.description) : undefined,
    price: input.fields.price,
    currency: sanitizeTextForQr(input.fields.currency),
    sku: input.fields.sku ? sanitizeTextForQr(input.fields.sku) : undefined,
    barcode: input.fields.barcode ? sanitizeTextForQr(input.fields.barcode) : undefined,
    category: input.fields.category ? sanitizeTextForQr(input.fields.category) : undefined,
    tags: input.fields.tags?.map((tag) => sanitizeTextForQr(tag)),
    taxRate: input.fields.taxRate,
    weight: input.fields.weight,
    dimensions: input.fields.dimensions,
  });
  const safeMetafields = input.metafields.map((metafield) =>
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
    productId: input.productId,
    organizationId: input.organizationId,
    fields: safeFields,
    metafields: safeMetafields,
  });

  const hybrid = `${OFFLINE_PACKET_MARKER}\n\n${plainText}\n\n[[FINANCELY_RICH_JSON]]\n${richPacket}`;
  if (hybrid.length <= HYBRID_QR_MAX_CHARS) {
    return {
      payload: hybrid,
      mode: "hybrid",
      packetVersion: PUBLIC_PRODUCT_QR_PACKET_VERSION,
    };
  }

  const compactText = truncateAtLineBoundaries(plainText, TEXT_QR_MAX_CHARS);
  return {
    payload: `${OFFLINE_PACKET_MARKER}\n\n${compactText}`,
    mode: "text-only",
    packetVersion: PUBLIC_PRODUCT_QR_PACKET_VERSION,
  };
}
