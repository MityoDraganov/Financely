import { getStorage } from "firebase-admin/storage";
import { loggerService } from "../logger-service";

/**
 * Simple Icons CDN — free, no auth, 3000+ brand SVGs.
 * Slug format: lowercase, spaces/dots/special chars stripped.
 * https://simpleicons.org/
 */
const SIMPLE_ICONS_CDN = "https://cdn.simpleicons.org";

/**
 * Known brand icon names that will never exist in Lucide.
 * Used as a fast membership check before attempting a CDN fetch.
 * Extend this list freely — it's just an optimisation to avoid
 * unnecessary 404 probes for clearly non-brand names like "check".
 */
const KNOWN_BRAND_SLUGS = new Set([
  "facebook", "instagram", "twitter", "x", "linkedin", "youtube",
  "tiktok", "snapchat", "pinterest", "reddit", "discord", "slack",
  "whatsapp", "telegram", "signal", "wechat",
  "google", "apple", "microsoft", "amazon", "meta",
  "github", "gitlab", "bitbucket", "stackoverflow",
  "stripe", "paypal", "visa", "mastercard", "amex", "americanexpress",
  "shopify", "woocommerce", "squarespace", "wordpress",
  "zoom", "googlemeet", "skype", "teams",
  "dropbox", "googledrive", "onedrive", "icloud",
  "netflix", "spotify", "twitch", "vimeo",
  "airbnb", "uber", "lyft",
  "figma", "sketch", "adobe", "canva",
  "aws", "googlecloud", "azure", "digitalocean", "vercel", "netlify",
  "firebase", "supabase", "mongodb", "postgresql", "mysql",
  "react", "vuedotjs", "angular", "svelte", "nextdotjs",
  "typescript", "javascript", "python", "nodejs",
]);

export type BrandIconResult = {
  slug: string;
  storageUrl: string;
};

/**
 * Converts a raw icon name from LLM output to a Simple Icons slug.
 * e.g. "Facebook" → "facebook", "Google Meet" → "googlemeet"
 */
function toSimpleIconsSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")       // remove spaces
    .replace(/\./g, "dot")     // node.js → nodedotjs
    .replace(/[^a-z0-9]/g, ""); // strip remaining special chars
}

/**
 * Returns true when the name looks like a brand that Simple Icons would have
 * but Lucide wouldn't — either it's in the known set, or it contains typical
 * brand markers (camelCase company name, etc.).
 */
export function looksLikeBrandIcon(iconName: string): boolean {
  const slug = toSimpleIconsSlug(iconName);
  return KNOWN_BRAND_SLUGS.has(slug);
}

/**
 * Fetches a brand SVG from Simple Icons CDN and uploads it to Firebase Storage.
 * Returns the public Storage URL, or null if the brand slug isn't found.
 *
 * SVGs are cached under organizations/{orgId}/brand-icons/{slug}.svg so the
 * same brand icon is only ever fetched+uploaded once per org.
 */
export async function fetchAndStoreBrandIcon(
  slug: string,
  orgId: string,
  color?: string
): Promise<string | null> {
  const normalizedSlug = toSimpleIconsSlug(slug);
  const storage = getStorage();
  const bucket = storage.bucket();

  // Use color-specific path if a hex colour is requested, otherwise default.
  const colorSuffix = color ? `/${color.replace("#", "")}` : "";
  const storagePath = `organizations/${orgId}/brand-icons/${normalizedSlug}${color ? `-${color.replace("#", "")}` : ""}.svg`;
  const storageFile = bucket.file(storagePath);

  // Return cached version if it already exists.
  try {
    const [exists] = await storageFile.exists();
    if (exists) {
      return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    }
  } catch {
    // If exists check fails, attempt fresh fetch below.
  }

  // Fetch from Simple Icons CDN.
  const cdnUrl = `${SIMPLE_ICONS_CDN}/${normalizedSlug}${colorSuffix}`;
  let svgBuffer: Buffer;
  try {
    const response = await fetch(cdnUrl);
    if (!response.ok) {
      // 404 means brand not found — not an error we should log loudly.
      if (response.status === 404) return null;
      loggerService.warn("Brand icon CDN fetch returned non-OK status", {
        slug: normalizedSlug,
        status: response.status,
        cdnUrl,
      });
      return null;
    }
    const bytes = await response.arrayBuffer();
    svgBuffer = Buffer.from(bytes);
  } catch (error) {
    loggerService.warn("Brand icon CDN fetch failed", {
      slug: normalizedSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  // Upload to Storage and make public.
  try {
    await storageFile.save(svgBuffer, {
      metadata: {
        contentType: "image/svg+xml",
        metadata: {
          source: "brand_icon",
          slug: normalizedSlug,
          orgId,
        },
      },
    });
    await storageFile.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch (error) {
    loggerService.warn("Brand icon Storage upload failed", {
      slug: normalizedSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
