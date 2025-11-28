# Cloudflare Wildcard Route Setup (One-Time Configuration)

## Purpose

Configure a **wildcard route** in Cloudflare so that **all subdomains** of `financely.app` automatically route to your Worker. This eliminates the need to configure routes for each individual brand site.

## Setup (One-Time)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **Workers & Pages** → **Routes**
4. Click **"Add route"**
5. Configure:
   - **Route:** `*.financely.app/*`
   - **Service:** `financely-sites-worker`
6. Click **"Save"**

## How It Works

- **Wildcard route** `*.financely.app/*` matches any subdomain:
  - `bloomora.financely.app` ✅
  - `acme-finance.financely.app` ✅
  - `any-subdomain.financely.app` ✅

- **Worker** receives the request and:
  1. Reads `Host` header (e.g., `bloomora.financely.app`)
  2. Looks up in KV: `bloomora.financely.app` → `brandSiteId:versionId`
  3. Fetches from R2: `sites/{brandSiteId}/{versionId}/index.html`
  4. Returns content

## DNS Still Required

Even with the wildcard route, you still need DNS records for each subdomain. The code automatically creates:
- **CNAME record**: `bloomora` → `financely-sites-worker.mityodraganow.workers.dev`
- **Proxied** (orange cloud) so Cloudflare handles routing

## Benefits

- ✅ **No manual route configuration** for each site
- ✅ **Automatic routing** for all subdomains
- ✅ **Scalable** to thousands of sites
- ✅ **Single configuration** handles everything

## Alternative: Per-Domain Routes

If you prefer per-domain routes (not recommended for scale):
- Configure individual routes: `bloomora.financely.app/*` → `financely-sites-worker`
- More maintenance, but gives you per-domain control

## Verification

After setting up the wildcard route, test:
```bash
curl -H "Host: test.financely.app" https://test.financely.app/
```

Should return content from your Worker (if KV mapping exists).

