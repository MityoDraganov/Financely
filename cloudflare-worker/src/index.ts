/**
 * Cloudflare Worker for serving multi-tenant brand sites
 * 
 * This worker serves all brand sites from a single runtime by:
 * 1. Reading the Host header to identify which brand site to serve
 * 2. Looking up the brandSiteId:versionId mapping in Cloudflare KV
 * 3. Fetching static assets from Cloudflare R2
 * 4. Returning the content with appropriate caching headers
 * 
 * Configuration (wrangler.toml):
 * - SITE_HOSTS: KV namespace mapping hostnames to "brandSiteId:versionId"
 * - SITES_BUCKET: R2 bucket containing static site files
 */

export interface Env {
  SITE_HOSTS: KVNamespace;
  SITES_BUCKET: R2Bucket;
  PUBLIC_PRODUCT_API_BASE?: string;
  FIREBASE_PROJECT_ID?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const host = request.headers.get("Host");
      const path = url.pathname;

      console.log(`[Worker] Request received: ${request.method} ${path}, Host: ${host}`);

      // Public catalog routes are dynamic and do not require brand-site KV host mapping.
      // Handle them first so workers.dev and direct route testing work.
      if (path.startsWith("/p/")) {
        return await handlePublicProductPath(request, url, env);
      }

      if (!host) {
        return new Response("Missing host header", { status: 400 });
      }

      // Normalize hostname (remove port if present)
      const hostname = host.split(":")[0].toLowerCase();
      console.log(`[Worker] Looking up hostname: ${hostname}`);

      // Look up hostname mapping in KV
      let mapping: string | null;
      try {
        const kvStart = Date.now();
        mapping = await env.SITE_HOSTS.get(hostname);
        const kvDuration = Date.now() - kvStart;
        console.log(`[Worker] KV lookup completed in ${kvDuration}ms, result: ${mapping || 'null'}`);
      } catch (error) {
        console.error("[Worker] KV lookup error:", error);
        return new Response(`KV lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }
      
      if (!mapping) {
        console.log(`[Worker] No KV mapping found for: ${hostname}`);
        return new Response(`Unknown site: ${hostname}. No KV mapping found.`, { 
          status: 404,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Parse mapping: "brandSiteId:versionId"
      const parts = mapping.split(":");
      if (parts.length !== 2) {
        console.error(`[Worker] Invalid mapping format: ${mapping}`);
        return new Response(`Invalid site mapping: ${mapping}`, { 
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }

      const [brandSiteId, versionId] = parts;
      if (!brandSiteId || !versionId) {
        console.error(`[Worker] Missing brandSiteId or versionId: ${mapping}`);
        return new Response(`Invalid site mapping format: ${mapping}`, { 
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }

      console.log(`[Worker] Parsed mapping - brandSiteId: ${brandSiteId}, versionId: ${versionId}`);

      // Build R2 key based on path
      // For root path, serve index.html
      // For other paths, try the path directly, then try path/index.html for subdirectories
      let sitePath = path;
      
      // Normalize path: ensure it starts with / and remove trailing slashes (except root)
      if (!sitePath.startsWith("/")) {
        sitePath = `/${sitePath}`;
      }
      if (sitePath !== "/" && sitePath.endsWith("/")) {
        sitePath = sitePath.slice(0, -1);
      }
      
      // For root, use index.html
      if (sitePath === "/") {
        sitePath = "/index.html";
      }
      
      // Build R2 key
      const normalizedPath = sitePath;
      let r2Key = `sites/${brandSiteId}/${versionId}${normalizedPath}`;
      console.log(`[Worker] Fetching from R2: ${r2Key}`);

      // Fetch object from R2
      let object: R2ObjectBody | null;
      try {
        const r2Start = Date.now();
        object = await env.SITES_BUCKET.get(r2Key);
        const r2Duration = Date.now() - r2Start;
        console.log(`[Worker] R2 fetch completed in ${r2Duration}ms, found: ${object !== null}`);
      } catch (error) {
        console.error(`[Worker] R2 fetch error for ${r2Key}:`, error);
        return new Response(`R2 fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // If not found, try alternative paths
      if (!object) {
        // If the path doesn't end with .html, try adding /index.html (for subdirectories like /contact)
        if (!normalizedPath.endsWith(".html") && !normalizedPath.endsWith("/")) {
          const altKey = `sites/${brandSiteId}/${versionId}${normalizedPath}/index.html`;
          console.log(`[Worker] Trying alternative R2 key (subdirectory): ${altKey}`);
          try {
            object = await env.SITES_BUCKET.get(altKey);
            if (object) {
              console.log(`[Worker] Found object with alternative key (subdirectory)`);
              return buildResponse(object);
            }
          } catch (error) {
            console.error(`[Worker] Alternative R2 fetch error:`, error);
          }
        }
        
        // If index.html not found at root, try without the / prefix
        if (normalizedPath === "/index.html") {
          const altKey = `sites/${brandSiteId}/${versionId}/index.html`;
          console.log(`[Worker] Trying alternative R2 key (root): ${altKey}`);
          try {
            object = await env.SITES_BUCKET.get(altKey);
            if (object) {
              console.log(`[Worker] Found object with alternative key (root)`);
              return buildResponse(object);
            }
          } catch (error) {
            console.error(`[Worker] Alternative R2 fetch error:`, error);
          }
        }
        
        console.log(`[Worker] R2 object not found: ${r2Key}`);
        return new Response(`Not found: ${r2Key}`, { 
          status: 404,
          headers: { "Content-Type": "text/plain" }
        });
      }

      console.log(`[Worker] Successfully serving: ${r2Key}`);
      return buildResponse(object);
    } catch (error) {
      console.error("[Worker] Unhandled error:", error);
      return new Response(`Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  },
};

/**
 * Build HTTP response from R2 object with appropriate headers
 */
function buildResponse(object: R2ObjectBody): Response {
  const headers = new Headers();
  
  // Copy HTTP metadata from R2 object (content-type, etc.)
  object.writeHttpMetadata(headers);
  
  // Set cache control headers
  // Public cache with 5 minute TTL (tune as needed)
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  
  // Add CORS headers if needed (adjust based on requirements)
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  
  // R2ObjectBody has a body property that is a ReadableStream
  return new Response(object.body, { headers });
}

type WorkerBreadcrumbItem = {
  label: string;
  path?: string;
};

type WorkerListingCard = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  category?: string;
  canonicalPath: string;
  canonicalUrl: string;
};

type WorkerPublicProductResponse =
  | {
      kind: "redirect";
      canonicalPath: string;
      canonicalUrl: string;
    }
  | {
      kind: "org_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        image?: string;
        robots: string;
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
        logoUrl?: string;
      };
      breadcrumb?: WorkerBreadcrumbItem[];
      collections: Array<{
        slug: string;
        label: string;
        count: number;
        path: string;
      }>;
      listing: {
        items: WorkerListingCard[];
        pagination: {
          limit: number;
          hasMore: boolean;
          nextCursor?: string;
        };
      };
    }
  | {
      kind: "collection_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        image?: string;
        robots: string;
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
        logoUrl?: string;
      };
      breadcrumb?: WorkerBreadcrumbItem[];
      collection: {
        slug: string;
        label: string;
        path: string;
      };
      collections: Array<{
        slug: string;
        label: string;
        count: number;
        path: string;
      }>;
      listing: {
        items: WorkerListingCard[];
        pagination: {
          limit: number;
          hasMore: boolean;
          nextCursor?: string;
        };
      };
    }
  | {
      kind: "product_detail";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        image?: string;
        robots: string;
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
        logoUrl?: string;
      };
      breadcrumb?: WorkerBreadcrumbItem[];
      product: {
        id: string;
        state: "published" | "unavailable";
        fields?: {
          name: string;
          description?: string;
          price: number;
          currency: string;
          sku?: string;
          barcode?: string;
          category?: string;
          tags?: string[];
          images?: string[];
        };
        metafields?: Array<{
          definitionId: string;
          name: string;
          type: string;
          description?: string;
          displayValue: string;
        }>;
      };
    };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function renderBreadcrumb(items?: WorkerBreadcrumbItem[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  const safeItems = items.filter((item) => item && typeof item.label === "string" && item.label.trim().length > 0);
  if (safeItems.length === 0) return "";
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${safeItems
    .map((item, idx) => {
      const isLast = idx === safeItems.length - 1;
      const label = escapeHtml(item.label);
      if (isLast || !item.path) {
        return `<span class="crumb current">${label}</span>`;
      }
      return `<a class="crumb" href="${escapeHtml(item.path)}">${label}</a>`;
    })
    .join('<span class="sep">/</span>')}</nav>`;
}

function renderCollectionNav(
  collections: Array<{ slug: string; label: string; count: number; path: string }>,
  activeCollectionSlug?: string,
): string {
  return `<div class="collections">${collections
    .map((entry) => {
      const active = activeCollectionSlug === entry.slug;
      return `<a class="collection-pill${active ? " active" : ""}" href="${escapeHtml(entry.path)}">
        <span>${escapeHtml(entry.label)}</span>
        <span class="count">${escapeHtml(String(entry.count))}</span>
      </a>`;
    })
    .join("")}</div>`;
}

function renderListingCards(items: WorkerListingCard[]): string {
  if (items.length === 0) {
    return `<section class="empty-card"><h2>No products yet</h2><p>No public products are available for this view.</p></section>`;
  }

  return `<section class="grid">${items
    .map((item) => {
      const image = item.image
        ? `<img class="card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />`
        : `<div class="card-image card-image-empty">No image</div>`;
      return `<a class="product-card" href="${escapeHtml(item.canonicalPath)}">
        ${image}
        <div class="card-content">
          ${item.category ? `<p class="category">${escapeHtml(item.category)}</p>` : ""}
          <h3>${escapeHtml(item.name)}</h3>
          <p class="price">${escapeHtml(formatPrice(item.price, item.currency))}</p>
        </div>
      </a>`;
    })
    .join("")}</section>`;
}

function fallbackBreadcrumb(payload: Exclude<WorkerPublicProductResponse, { kind: "redirect" }>): WorkerBreadcrumbItem[] {
  if (payload.kind === "org_products") {
    return [
      { label: "Home", path: "/" },
      { label: "All Products" },
    ];
  }

  const orgProductsPath = `/p/${payload.organization.orgSlug}`;
  if (payload.kind === "collection_products") {
    return [
      { label: "Home", path: "/" },
      { label: "All Products", path: orgProductsPath },
      { label: payload.collection.label },
    ];
  }

  const items: WorkerBreadcrumbItem[] = [
    { label: "Home", path: "/" },
    { label: "All Products", path: orgProductsPath },
  ];
  const category = payload.product.fields?.category;
  if (typeof category === "string" && category.trim().length > 0) {
    items.push({ label: category.trim() });
  }
  items.push({ label: payload.product.fields?.name || "Product" });
  return items;
}

function resolveBreadcrumb(payload: Exclude<WorkerPublicProductResponse, { kind: "redirect" }>): WorkerBreadcrumbItem[] {
  if (Array.isArray(payload.breadcrumb) && payload.breadcrumb.length > 0) {
    return payload.breadcrumb;
  }
  return fallbackBreadcrumb(payload);
}

function renderWorkerProductHtml(payload: WorkerPublicProductResponse): string {
  if (payload.kind === "redirect") {
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Redirecting…</title></head><body>Redirecting…</body></html>`;
  }

  const breadcrumb = resolveBreadcrumb(payload);
  if (payload.kind === "org_products" || payload.kind === "collection_products") {
    const heading =
      payload.kind === "collection_products"
        ? `${escapeHtml(payload.collection.label)}`
        : "All Products";
    const collectionNav = renderCollectionNav(
      payload.collections,
      payload.kind === "collection_products" ? payload.collection.slug : undefined,
    );
    const listing = renderListingCards(payload.listing.items);
    const nextPageLink = payload.listing.pagination.nextCursor
      ? (() => {
          const next = new URL(payload.canonicalPath, "https://financely.app");
          next.searchParams.set("cursor", payload.listing.pagination.nextCursor || "");
          return `<div class="pager"><a href="${escapeHtml(next.pathname + next.search)}">Next Page</a></div>`;
        })()
      : "";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.seo.title)}</title>
    <meta name="description" content="${escapeHtml(payload.seo.description)}" />
    <meta name="robots" content="${escapeHtml(payload.seo.robots)}" />
    <link rel="canonical" href="${escapeHtml(payload.seo.canonicalUrl)}" />
    ${payload.seo.image ? `<meta property="og:image" content="${escapeHtml(payload.seo.image)}" />` : ""}
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; background: #f4f5f7; color: #111827; }
      .container { max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }
      .org { margin: 0 0 6px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
      h1 { margin: 0 0 14px; font-size: 30px; line-height: 1.2; }
      .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; margin: 0 0 14px; }
      .crumb { color: #4b5563; text-decoration: none; }
      .crumb:hover { color: #111827; }
      .crumb.current { color: #111827; }
      .sep { color: #9ca3af; }
      .collections { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
      .collection-pill { display: inline-flex; gap: 8px; align-items: center; text-decoration: none; border: 1px solid #d1d5db; border-radius: 999px; padding: 6px 10px; color: #374151; background: #fff; font-size: 13px; }
      .collection-pill .count { color: #6b7280; }
      .collection-pill.active { border-color: #111827; color: #111827; }
      .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      .product-card { display: block; text-decoration: none; color: inherit; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(17, 24, 39, 0.04); }
      .card-image { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: #f9fafb; }
      .card-image-empty { display: grid; place-items: center; color: #9ca3af; font-size: 13px; }
      .card-content { padding: 12px; }
      .category { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; }
      h3 { margin: 5px 0 6px; font-size: 16px; line-height: 1.35; }
      .price { margin: 0; font-size: 14px; color: #111827; font-weight: 600; }
      .empty-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
      .empty-card h2 { margin: 0 0 6px; font-size: 20px; }
      .empty-card p { margin: 0; color: #6b7280; }
      .pager { margin-top: 18px; }
      .pager a { display: inline-block; text-decoration: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; background: #fff; color: #111827; font-size: 14px; }
    </style>
  </head>
  <body>
    <main class="container">
      ${renderBreadcrumb(breadcrumb)}
      <p class="org">${escapeHtml(payload.organization.name)}</p>
      <h1>${heading}</h1>
      ${collectionNav}
      ${listing}
      ${nextPageLink}
    </main>
  </body>
</html>`;
  }

  if (payload.product.state === "unavailable") {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.seo.title)}</title>
    <meta name="description" content="${escapeHtml(payload.seo.description)}" />
    <meta name="robots" content="${escapeHtml(payload.seo.robots)}" />
    <link rel="canonical" href="${escapeHtml(payload.seo.canonicalUrl)}" />
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; background: #f5f6f8; color: #111827; }
      .container { max-width: 720px; margin: 0 auto; padding: 48px 16px; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
      .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; margin: 0 0 14px; }
      .crumb { color: #4b5563; text-decoration: none; }
      .crumb.current { color: #111827; }
      .sep { color: #9ca3af; }
      h1 { margin: 0 0 8px 0; font-size: 24px; }
      p { margin: 0; color: #4b5563; }
    </style>
  </head>
  <body>
    <main class="container">
      ${renderBreadcrumb(breadcrumb)}
      <section class="card">
        <h1>This product is currently unavailable</h1>
        <p>${escapeHtml(payload.organization.name)} has not published this product right now.</p>
      </section>
    </main>
  </body>
</html>`;
  }

  const fields = payload.product.fields;
  const metafields = payload.product.metafields || [];
  const image = fields?.images?.[0];
  const tags = fields?.tags || [];
  const tagHtml = tags.length
    ? `<div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";
  const metafieldHtml = metafields.length
    ? `<section class="meta-grid">${metafields
        .map(
          (entry) => `<article class="meta-item">
            <h3>${escapeHtml(entry.name)}</h3>
            ${entry.description ? `<p class="meta-desc">${escapeHtml(entry.description)}</p>` : ""}
            <p class="meta-value">${escapeHtml(entry.displayValue)}</p>
          </article>`,
        )
        .join("")}</section>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.seo.title)}</title>
    <meta name="description" content="${escapeHtml(payload.seo.description)}" />
    <meta name="robots" content="${escapeHtml(payload.seo.robots)}" />
    <link rel="canonical" href="${escapeHtml(payload.seo.canonicalUrl)}" />
    ${payload.seo.image ? `<meta property="og:image" content="${escapeHtml(payload.seo.image)}" />` : ""}
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; background: #f3f4f6; color: #111827; }
      .container { max-width: 960px; margin: 0 auto; padding: 32px 16px 48px; }
      .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; margin: 0 0 14px; }
      .crumb { color: #4b5563; text-decoration: none; }
      .crumb:hover { color: #111827; }
      .crumb.current { color: #111827; }
      .sep { color: #9ca3af; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(17,24,39,0.04); }
      .content { padding: 20px; }
      .org { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin: 0 0 6px; }
      h1 { margin: 0; font-size: 30px; line-height: 1.2; }
      .price { font-size: 22px; font-weight: 700; margin: 12px 0 0; }
      .desc { color: #374151; margin: 16px 0 0; line-height: 1.6; white-space: pre-wrap; }
      .hero { width: 100%; max-height: 460px; object-fit: cover; display: block; border-bottom: 1px solid #e5e7eb; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .tag { border: 1px solid #d1d5db; border-radius: 999px; padding: 4px 10px; font-size: 12px; color: #4b5563; background: #fff; }
      .meta-grid { margin-top: 20px; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .meta-item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
      .meta-item h3 { margin: 0 0 4px; font-size: 14px; }
      .meta-desc { margin: 0 0 6px; font-size: 12px; color: #6b7280; }
      .meta-value { margin: 0; font-size: 14px; color: #111827; white-space: pre-wrap; word-break: break-word; }
      .meta-strip { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
      .meta-pill { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 12px; color: #4b5563; }
    </style>
  </head>
  <body>
    <main class="container">
      ${renderBreadcrumb(breadcrumb)}
      <article class="card">
        ${image ? `<img class="hero" src="${escapeHtml(image)}" alt="${escapeHtml(fields?.name || "Product image")}" />` : ""}
        <div class="content">
          <p class="org">${escapeHtml(payload.organization.name)}</p>
          <h1>${escapeHtml(fields?.name || "Product")}</h1>
          <p class="price">${escapeHtml(formatPrice(fields?.price || 0, fields?.currency || "USD"))}</p>
          <div class="meta-strip">
            ${fields?.category ? `<span class="meta-pill">Category: ${escapeHtml(fields.category)}</span>` : ""}
            ${fields?.barcode ? `<span class="meta-pill">Barcode: ${escapeHtml(fields.barcode)}</span>` : ""}
          </div>
          ${fields?.description ? `<p class="desc">${escapeHtml(fields.description)}</p>` : ""}
          ${tagHtml}
          ${metafieldHtml}
        </div>
      </article>
    </main>
  </body>
</html>`;
}

async function handlePublicProductPath(request: Request, url: URL, env: Env): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "p") {
    return new Response("Not found", { status: 404 });
  }

  let orgSlug = "";
  let productSlug = "";
  let collectionSlug = "";

  if (segments.length === 2) {
    orgSlug = segments[1];
  } else if (segments.length === 4 && segments[2] === "c") {
    orgSlug = segments[1];
    collectionSlug = segments[3];
  } else if (segments.length === 3) {
    orgSlug = segments[1];
    productSlug = segments[2];
  } else {
    return new Response("Not found", { status: 404 });
  }

  const defaultApi =
    env.FIREBASE_PROJECT_ID
      ? `https://us-central1-${env.FIREBASE_PROJECT_ID}.cloudfunctions.net/getPublicProductPage`
      : "";
  const apiBase = env.PUBLIC_PRODUCT_API_BASE || defaultApi;
  if (!apiBase) {
    return new Response("Public product API is not configured", { status: 500 });
  }

  const apiUrl = new URL(apiBase);
  apiUrl.searchParams.set("orgSlug", orgSlug);
  if (productSlug) {
    apiUrl.searchParams.set("productSlug", productSlug);
  }
  if (collectionSlug) {
    apiUrl.searchParams.set("collectionSlug", collectionSlug);
  }
  const cursor = url.searchParams.get("cursor");
  if (cursor) {
    apiUrl.searchParams.set("cursor", cursor);
  }
  apiUrl.searchParams.set("mode", "json");

  const apiResponse = await fetch(apiUrl.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      ...(request.headers.get("Accept-Language")
        ? { "Accept-Language": request.headers.get("Accept-Language") as string }
        : {}),
    },
  });

  if (!apiResponse.ok) {
    let upstreamError = "";
    try {
      const payload = (await apiResponse.json()) as { error?: string };
      if (typeof payload?.error === "string") {
        upstreamError = payload.error;
      }
    } catch {
      // Ignore parse failures and fall back to generic messages.
    }
    if (apiResponse.status === 404) {
      return new Response(
        upstreamError
          ? `Public page not found: ${upstreamError}`
          : "Public page not found",
        {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
    if (upstreamError) {
      return new Response(`Failed to load public catalog page: ${upstreamError}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("Failed to load public catalog page", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const payload = (await apiResponse.json()) as WorkerPublicProductResponse;
  if (payload.kind === "redirect") {
    return Response.redirect(payload.canonicalUrl, 301);
  }

  const html = renderWorkerProductHtml(payload);
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  headers.set("Vary", "Accept-Language");
  return new Response(html, { status: 200, headers });
}
