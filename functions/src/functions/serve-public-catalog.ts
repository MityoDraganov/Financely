/**
 * HTTP function that serves the public catalog SPA with server-injected Open Graph meta tags.
 *
 * Firebase Hosting rewrites /p/** to this function so that social media crawlers
 * (Facebook, Twitter/X, LinkedIn, Slack, WhatsApp, iMessage, Discord, etc.) which do
 * not execute JavaScript can still read OG tags from the initial HTML response.
 *
 * Strategy:
 *  1. Fetch minimal data from Firestore (org name/logo, product name/image if applicable).
 *  2. Inject OG + Twitter Card tags into the SPA index.html shell.
 *  3. Return the enriched HTML — bots read the tags, browsers bootstrap the React app normally.
 *
 * The index.html shell is cached in memory (5-minute TTL) to avoid redundant fetches.
 */
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAppOrigin } from "../config/app-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedPath =
  | { kind: "org_products"; orgSlug: string }
  | { kind: "collection_products"; orgSlug: string; collectionSlug: string }
  | { kind: "product_detail"; orgSlug: string; productSlug: string }
  | null;

interface OgMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
  type: "website" | "product";
  siteName: string;
}

// ---------------------------------------------------------------------------
// SPA shell cache
// ---------------------------------------------------------------------------

interface ShellCache {
  html: string;
  fetchedAt: number;
}

let spaShellCache: ShellCache | null = null;
const SPA_SHELL_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSpaShell(baseUrl: string): Promise<string> {
  const now = Date.now();
  if (spaShellCache && now - spaShellCache.fetchedAt < SPA_SHELL_TTL_MS) {
    return spaShellCache.html;
  }
  const res = await fetch(`${baseUrl}/index.html`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`Failed to fetch index.html: ${res.status}`);
  const html = await res.text();
  spaShellCache = { html, fetchedAt: now };
  return html;
}

// ---------------------------------------------------------------------------
// URL path parser
// ---------------------------------------------------------------------------

function parseCatalogPath(pathname: string): ParsedPath {
  // /p/:orgSlug                      → org_products
  // /p/:orgSlug/c/:collectionSlug    → collection_products
  // /p/:orgSlug/:productSlug         → product_detail
  const match = pathname.match(/^\/p\/([^/?#]+)(?:\/c\/([^/?#]+)|\/([^/?#]+))?(?:[/?#].*)?$/);
  if (!match) return null;

  const [, orgSlug, collectionSlug, productSlug] = match;
  if (!orgSlug) return null;

  if (collectionSlug) return { kind: "collection_products", orgSlug, collectionSlug };
  if (productSlug) return { kind: "product_detail", orgSlug, productSlug };
  return { kind: "org_products", orgSlug };
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildOgTags(meta: OgMeta): string {
  const lines: string[] = [
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(meta.url)}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:site_name" content="${esc(meta.siteName)}" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
  ];

  if (meta.image) {
    lines.push(`<meta property="og:image" content="${esc(meta.image)}" />`);
    lines.push(`<meta property="og:image:width" content="1200" />`);
    lines.push(`<meta property="og:image:height" content="630" />`);
    lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
    lines.push(`<meta name="twitter:image" content="${esc(meta.image)}" />`);
  } else {
    lines.push(`<meta name="twitter:card" content="summary" />`);
  }

  return lines.join("\n    ");
}

function injectOgIntoShell(shell: string, meta: OgMeta, canonicalUrl: string): string {
  const titleTag = `<title>${esc(meta.title)}</title>`;
  const descTag = `<meta name="description" content="${esc(meta.description)}" />`;
  const canonicalTag = `<link rel="canonical" href="${esc(canonicalUrl)}" />`;
  const ogTags = buildOgTags(meta);

  const injection = `    ${titleTag}\n    ${descTag}\n    ${canonicalTag}\n    ${ogTags}`;

  // Replace existing <title> if present, then inject OG block before </head>
  const withTitle = shell.replace(/<title>[^<]*<\/title>/, titleTag);
  return withTitle.replace("</head>", `${injection}\n  </head>`);
}

// ---------------------------------------------------------------------------
// Firestore lookups (minimal — only what OG needs)
// ---------------------------------------------------------------------------

interface OrgData {
  id: string;
  name: string;
  logoUrl?: string;
}

async function getOrgBySlug(db: FirebaseFirestore.Firestore, orgSlug: string): Promise<OrgData | null> {
  const snap = await db
    .collection("organizations")
    .where("settings.publicPages.orgSlug", "==", orgSlug)
    .limit(1)
    .get();

  if (!snap.empty) {
    const d = snap.docs[0].data();
    return {
      id: snap.docs[0].id,
      name: d.name ?? orgSlug,
      logoUrl: d.settings?.branding?.customLogo || d.logoUrl,
    };
  }

  // Alias fallback
  const aliasSnap = await db
    .collection("organizations")
    .where("settings.publicPages.orgSlugAliases", "array-contains", orgSlug)
    .limit(1)
    .get();

  if (!aliasSnap.empty) {
    const d = aliasSnap.docs[0].data();
    return {
      id: aliasSnap.docs[0].id,
      name: d.name ?? orgSlug,
      logoUrl: d.settings?.branding?.customLogo || d.logoUrl,
    };
  }

  return null;
}

async function getFirstProductImage(
  db: FirebaseFirestore.Firestore,
  organizationId: string,
  collectionSlug?: string,
): Promise<string | undefined> {
  let q = db
    .collection("products")
    .where("organizationId", "==", organizationId)
    .where("status", "==", "active");

  if (collectionSlug) {
    q = q.where("publicPage.collectionSlug", "==", collectionSlug) as typeof q;
  }

  const snap = await q.limit(3).get();

  for (const doc of snap.docs) {
    const images: string[] | undefined = doc.data()?.publicPage?.detailSnapshot?.fields?.images;
    if (images && images.length > 0) return images[0];
  }

  return undefined;
}

async function getProductOgData(
  db: FirebaseFirestore.Firestore,
  organizationId: string,
  productSlug: string,
): Promise<{ name: string; description?: string; image?: string } | null> {
  const snap = await db
    .collection("products")
    .where("organizationId", "==", organizationId)
    .where("publicPage.slug", "==", productSlug)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const d = snap.docs[0].data();
  const fields = d?.publicPage?.detailSnapshot?.fields;
  return {
    name: fields?.name ?? d.name ?? productSlug,
    description: fields?.description,
    image: fields?.images?.[0],
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const servePublicCatalog = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    invoker: "public",
  },
  async (req, res) => {
    const baseUrl = getAppOrigin();
    const pathname = req.path || "/";
    const fullUrl = `${baseUrl}${pathname}`;

    const parsed = parseCatalogPath(pathname);

    // Serve SPA shell without OG injection for unrecognised paths
    if (!parsed) {
      try {
        const shell = await getSpaShell(baseUrl);
        res.set("Content-Type", "text/html; charset=utf-8").send(shell);
      } catch {
        res.redirect(302, fullUrl);
      }
      return;
    }

    const db = getFirestore();
    let ogMeta: OgMeta;

    try {
      const org = await getOrgBySlug(db, parsed.orgSlug);

      if (!org) {
        // Org not found — serve shell, the SPA will show its own error page
        const shell = await getSpaShell(baseUrl);
        res.set("Content-Type", "text/html; charset=utf-8").send(shell);
        return;
      }

      if (parsed.kind === "product_detail") {
        const product = await getProductOgData(db, org.id, parsed.productSlug);
        if (product) {
          ogMeta = {
            title: `${product.name} · ${org.name}`,
            description: product.description ?? `View ${product.name} on ${org.name}`,
            image: product.image ?? org.logoUrl,
            url: fullUrl,
            type: "product",
            siteName: org.name,
          };
        } else {
          ogMeta = {
            title: org.name,
            description: `Browse products from ${org.name}`,
            image: org.logoUrl,
            url: fullUrl,
            type: "website",
            siteName: org.name,
          };
        }
      } else if (parsed.kind === "collection_products") {
        const collectionLabel = humanizeSlug(parsed.collectionSlug);
        const firstImage = await getFirstProductImage(db, org.id, parsed.collectionSlug);
        ogMeta = {
          title: `${collectionLabel} · ${org.name}`,
          description: `Browse ${collectionLabel} products from ${org.name}`,
          image: firstImage ?? org.logoUrl,
          url: fullUrl,
          type: "website",
          siteName: org.name,
        };
      } else {
        // org_products
        const firstImage = await getFirstProductImage(db, org.id);
        ogMeta = {
          title: org.name,
          description: `Browse all products from ${org.name}`,
          image: firstImage ?? org.logoUrl,
          url: fullUrl,
          type: "website",
          siteName: org.name,
        };
      }

      const shell = await getSpaShell(baseUrl);
      const enrichedHtml = injectOgIntoShell(shell, ogMeta, fullUrl);

      res.set("Content-Type", "text/html; charset=utf-8");
      // Cache 5 minutes at the CDN, 60 seconds at the browser
      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      res.send(enrichedHtml);
    } catch (err) {
      // On any error fall back to plain SPA so users are never blocked
      try {
        const shell = await getSpaShell(baseUrl);
        res.set("Content-Type", "text/html; charset=utf-8").send(shell);
      } catch {
        res.redirect(302, `${baseUrl}/`);
      }
    }
  },
);
