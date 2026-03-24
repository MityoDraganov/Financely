import { getFirestore } from "firebase-admin/firestore";
import { slugifySegment } from "./public-product-page-service";

export const PUBLIC_ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PUBLIC_ORG_SLUG_MAX_LENGTH = 64;
const SLUG_FALLBACK_PREFIX = "organization";
const MAX_UNIQUE_SUFFIX_ATTEMPTS = 5000;

function normalizeBase(value: string): string {
  const compact = slugifySegment(value || "");
  const truncated = compact.slice(0, PUBLIC_ORG_SLUG_MAX_LENGTH).replace(/-+$/g, "");
  return truncated || "";
}

function buildFallbackSlug(organizationId?: string): string {
  const idSeed = (organizationId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  const fallback = idSeed ? `${SLUG_FALLBACK_PREFIX}-${idSeed}` : SLUG_FALLBACK_PREFIX;
  return normalizeBase(fallback) || SLUG_FALLBACK_PREFIX;
}

function applySuffix(base: string, index: number): string {
  if (index <= 1) return base;
  const suffix = `-${index}`;
  const stem = base.slice(0, Math.max(1, PUBLIC_ORG_SLUG_MAX_LENGTH - suffix.length)).replace(/-+$/g, "");
  return `${stem}${suffix}`;
}

async function findOrganizationIdBySlug(slug: string): Promise<string | null> {
  const db = getFirestore();
  const snapshot = await db
    .collection("organizations")
    .where("settings.publicPages.orgSlug", "==", slug)
    .limit(2)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0]?.id || null;
}

export function normalizePublicOrgSlug(
  requestedSlug: string | undefined,
  organizationId?: string,
): string {
  const normalized = normalizeBase((requestedSlug || "").trim());
  if (normalized) return normalized;
  return buildFallbackSlug(organizationId);
}

export function isValidPublicOrgSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= PUBLIC_ORG_SLUG_MAX_LENGTH &&
    PUBLIC_ORG_SLUG_PATTERN.test(slug)
  );
}

export function ensureUniqueSlugInSet(baseSlug: string, used: Set<string>): string {
  const normalizedBase = normalizeBase(baseSlug) || SLUG_FALLBACK_PREFIX;
  let index = 1;
  while (index <= MAX_UNIQUE_SUFFIX_ATTEMPTS) {
    const candidate = applySuffix(normalizedBase, index);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    index += 1;
  }
  throw new Error("Could not generate a unique organization slug");
}

export async function resolveUniqueOrganizationSlug(params: {
  requestedSlug?: string;
  fallbackName?: string;
  organizationId?: string;
}): Promise<string> {
  const rawBase = params.requestedSlug?.trim() || params.fallbackName?.trim() || "";
  const normalizedBase =
    normalizePublicOrgSlug(rawBase, params.organizationId) || buildFallbackSlug(params.organizationId);

  for (let index = 1; index <= MAX_UNIQUE_SUFFIX_ATTEMPTS; index += 1) {
    const candidate = applySuffix(normalizedBase, index);
    const matchedOrganizationId = await findOrganizationIdBySlug(candidate);
    if (!matchedOrganizationId || matchedOrganizationId === params.organizationId) {
      return candidate;
    }
  }

  throw new Error("Could not resolve a unique organization slug");
}

