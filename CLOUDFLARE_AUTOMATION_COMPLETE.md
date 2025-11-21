# Cloudflare Automation - Complete ✅

## What Was Done

The site generation flow has been **fully automated** to use Cloudflare instead of Firebase Hosting. From frontend to working site, everything happens automatically.

### Changes Made

1. **Updated `handle-generate-site.ts`**
   - Removed Firebase Hosting deployment
   - Added Cloudflare R2 upload
   - Added Cloudflare KV mapping
   - Added automatic DNS subdomain creation
   - Sets `hostingProvider: "cloudflare"` in Firestore

2. **Updated `deploy-manual-site.ts`**
   - Now uses Cloudflare publisher instead of Firebase Hosting
   - Manual deployments also go to Cloudflare

3. **Updated `brand-site-processor.ts`**
   - Added Cloudflare publisher secrets to config
   - Passes publisher config to `handleGenerateSite`

4. **Updated `GenerateSiteConfig` interface**
   - Added `cloudflareAccountId`, `cloudflareR2BucketName`, `cloudflareKvNamespaceId`

## One-Time Setup Required

### 1. Configure Wildcard Route (Required)

**This is the only manual step needed!**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Routes**
3. Click **"Add route"**
4. Configure:
   - **Route:** `*.financely.app/*`
   - **Service:** `financely-sites-worker`
5. Click **"Save"**

This wildcard route makes **all subdomains** automatically route to your Worker. Without this, you'll get Error 1016.

### 2. Verify Secrets Are Set

Make sure these Firebase secrets are configured:
```bash
firebase functions:secrets:access CLOUDFLARE_ACCOUNT_ID
firebase functions:secrets:access CLOUDFLARE_API_TOKEN
firebase functions:secrets:access CLOUDFLARE_R2_BUCKET_NAME
firebase functions:secrets:access CLOUDFLARE_KV_NAMESPACE_ID
firebase functions:secrets:access CLOUDFLARE_ZONE_ID
firebase functions:secrets:access CLOUDFLARE_BASE_DOMAIN
```

## How It Works Now

### Automatic Flow (Frontend → Working Site)

1. **User clicks "Generate Site"** in frontend
2. **`generateSite` function** creates Firestore document with `status: "pending"`
3. **`onBrandSiteCreated` trigger** fires
4. **`handleGenerateSite`** runs:
   - Generates HTML with AI
   - Uploads files to **Cloudflare R2**
   - Creates **DNS CNAME** for subdomain (e.g., `bloomora.financely.app`)
   - Updates **Cloudflare KV** with mapping: `bloomora.financely.app` → `brandSiteId:versionId`
   - Updates Firestore with `hostingProvider: "cloudflare"` and `deployedUrl`
5. **Frontend** shows working link: `https://bloomora.financely.app`

### Worker Routing

1. Request comes to `bloomora.financely.app`
2. **Wildcard route** `*.financely.app/*` matches and routes to Worker
3. **Worker** reads `Host` header: `bloomora.financely.app`
4. **Worker** looks up in KV: `bloomora.financely.app` → `brandSiteId:versionId`
5. **Worker** fetches from R2: `sites/{brandSiteId}/{versionId}/index.html`
6. **Worker** returns content

## Testing

After setting up the wildcard route:

1. **Generate a new site** from the frontend
2. **Wait for generation** to complete (status: "success")
3. **Click the link** - should work immediately!

## Troubleshooting

### Error 1016: Origin DNS error
- **Cause:** Wildcard route not configured
- **Fix:** Follow "One-Time Setup" step 1 above

### Site not found (404)
- **Cause:** KV mapping missing or incorrect
- **Fix:** Check KV namespace:
  ```bash
  wrangler kv key get --namespace-id=YOUR_KV_ID "subdomain.financely.app"
  ```
  Should return: `brandSiteId:versionId`

### Files not in R2
- **Cause:** R2 upload failed
- **Fix:** Check Firebase Function logs for R2 upload errors

## Next Steps

1. ✅ **Set up wildcard route** (one-time)
2. ✅ **Deploy updated functions:**
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions:onBrandSiteCreated,functions:onBrandSiteUpdated,functions:deployManualSite
   ```
3. ✅ **Test by generating a new site**

## Benefits

- ✅ **Fully automated** - no manual steps per site
- ✅ **Scalable** - handles thousands of sites
- ✅ **Fast** - Cloudflare edge network
- ✅ **Cost-effective** - no Firebase Hosting quota limits
- ✅ **Unified** - all sites use same Worker + R2 + KV

