# Fix Cloudflare Error 1016 - Domain Routing

## Problem
The domain `bloomora.financely.app` exists but isn't routed to the Cloudflare Worker, causing Error 1016.

## Solution

### Option 1: Configure Workers Route (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **Workers & Pages** → **Routes**
4. Click **"Add route"**
5. Configure:
   - **Route:** `bloomora.financely.app/*`
   - **Service:** `financely-sites-worker`
6. Click **"Save"**

This will route all traffic from `bloomora.financely.app` to your Worker.

### Option 2: Update DNS to Point to Worker

If you prefer DNS-based routing:

1. Go to Cloudflare Dashboard → **DNS** for `financely.app`
2. Find the `bloomora` CNAME record
3. Update it to point to: `financely-sites-worker.mityodraganow.workers.dev`
4. Keep it **Proxied** (orange cloud)

## After Routing is Fixed

Once the route is configured, you need to:

1. **Publish the site to Cloudflare** using `publishBrandSite` function
2. This will:
   - Upload HTML/assets to R2
   - Create KV mapping: `bloomora.financely.app` → `brandSiteId:versionId`

## Quick Test

After configuring the route, test:
```bash
# Check if KV mapping exists
wrangler kv key get --namespace-id=c989958d896c45fdababde535507edd3 "bloomora.financely.app"

# If it doesn't exist, you need to publish the site to Cloudflare
```

## For Future Sites

To avoid this issue for new sites, update the site generation flow to:
1. Use `publishBrandSite` instead of Firebase Hosting
2. Automatically configure Workers Routes (or use DNS)
3. Create KV mappings during publish

