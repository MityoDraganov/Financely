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

