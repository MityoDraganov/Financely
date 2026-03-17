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

      console.log(`[Worker] Request received: ${request.method} ${url.pathname}, Host: ${host}`);

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
      let path = url.pathname;

      if (path.startsWith("/p/")) {
        return await handlePublicProductPath(url, env);
      }
      
      // Normalize path: ensure it starts with / and remove trailing slashes (except root)
      if (!path.startsWith("/")) {
        path = `/${path}`;
      }
      if (path !== "/" && path.endsWith("/")) {
        path = path.slice(0, -1);
      }
      
      // For root, use index.html
      if (path === "/") {
        path = "/index.html";
      }
      
      // Build R2 key
      const normalizedPath = path;
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

type WorkerPublicProductResponse =
  | {
      kind: "ok";
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
      product: {
        id: string;
        state: "published";
        fields: {
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
        metafields: Array<{
          definitionId: string;
          name: string;
          type: string;
          description?: string;
          displayValue: string;
        }>;
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
        robots: string;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderWorkerProductHtml(payload: WorkerPublicProductResponse): string {
  if (payload.kind === "unavailable") {
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
      h1 { margin: 0 0 8px 0; font-size: 24px; }
      p { margin: 0; color: #4b5563; }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="card">
        <h1>This product is currently unavailable</h1>
        <p>${escapeHtml(payload.organization.name)} has not published this product right now.</p>
      </section>
    </main>
  </body>
</html>`;
  }

  if (payload.kind !== "ok") {
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Redirecting…</title></head><body>Redirecting…</body></html>`;
  }

  const image = payload.product.fields.images?.[0];
  const tags = payload.product.fields.tags || [];
  const metafields = payload.product.metafields || [];

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
      <article class="card">
        ${image ? `<img class="hero" src="${escapeHtml(image)}" alt="${escapeHtml(payload.product.fields.name)}" />` : ""}
        <div class="content">
          <p class="org">${escapeHtml(payload.organization.name)}</p>
          <h1>${escapeHtml(payload.product.fields.name)}</h1>
          <p class="price">${escapeHtml(String(payload.product.fields.price))} ${escapeHtml(payload.product.fields.currency)}</p>
          <div class="meta-strip">
            ${payload.product.fields.category ? `<span class="meta-pill">Category: ${escapeHtml(payload.product.fields.category)}</span>` : ""}
            ${payload.product.fields.sku ? `<span class="meta-pill">SKU: ${escapeHtml(payload.product.fields.sku)}</span>` : ""}
            ${payload.product.fields.barcode ? `<span class="meta-pill">Barcode: ${escapeHtml(payload.product.fields.barcode)}</span>` : ""}
          </div>
          ${payload.product.fields.description ? `<p class="desc">${escapeHtml(payload.product.fields.description)}</p>` : ""}
          ${tagHtml}
          ${metafieldHtml}
        </div>
      </article>
    </main>
  </body>
</html>`;
}

async function handlePublicProductPath(url: URL, env: Env): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[0] !== "p") {
    return new Response("Not found", { status: 404 });
  }

  const orgSlug = segments[1];
  const productSlug = segments[2];
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
  apiUrl.searchParams.set("productSlug", productSlug);
  apiUrl.searchParams.set("mode", "json");

  const apiResponse = await fetch(apiUrl.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!apiResponse.ok) {
    if (apiResponse.status === 404) {
      return new Response("Product page not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("Failed to load public product page", {
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
  return new Response(html, { status: 200, headers });
}
