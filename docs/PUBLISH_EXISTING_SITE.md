# Publishing Existing Site to Cloudflare

## Problem

The site `bloomora.financely.app` was generated with the **old Firebase Hosting flow**, so it's not in Cloudflare yet. That's why you're getting Error 522 - the Worker can't find the KV mapping.

## Solution: Publish to Cloudflare

You have two options:

### Option 1: Use `publishBrandSite` Function (Quick Fix)

If the site has HTML stored in Firestore:

1. **Find the brand site ID:**
   - Go to Firebase Console → Firestore
   - Find the `brandSites` collection
   - Look for the site with `subdomain: "bloomora"` or `deployedUrl` containing "bloomora"
   - Copy the document ID (this is the `brandSiteId`)

2. **Call the publish function:**
   - Go to Firebase Console → Functions
   - Find `publishBrandSite`
   - Test it with:
   ```json
   {
     "brandSiteId": "YOUR_BRAND_SITE_ID",
     "html": "<html>...</html>",  // Get from Firestore
     "sourceType": "ai-builder"
   }
   ```

3. **Or use the frontend:**
   - If you have a "Publish" button in the Site Builder UI, use that

### Option 2: Regenerate the Site (Recommended)

Since the new flow is automated, just **regenerate the site**:

1. Go to your Site Builder
2. Find the "bloomora" brand site
3. Click "Regenerate" or create a new version
4. The new automated flow will:
   - Upload to R2
   - Create KV mapping
   - Set up DNS
   - Everything automatic!

## Verify After Publishing

After publishing, verify:

```bash
# Check KV mapping
wrangler kv key get --namespace-id=c989958d896c45fdababde535507edd3 "bloomora.financely.app"

# Should return: brandSiteId:versionId
```

## Why This Happened

- The site was generated **before** we updated the code to use Cloudflare
- The old flow used Firebase Hosting, not Cloudflare
- The new automated flow (after deployment) will work automatically

## Next Steps

1. **Publish the existing site** (Option 1 or 2 above)
2. **Deploy the updated functions:**
   ```bash
   cd functions
   firebase deploy --only functions:onBrandSiteCreated,functions:onBrandSiteUpdated
   ```
3. **Set up wildcard route** (if not done):
   - Cloudflare Dashboard → Workers & Pages → Routes
   - Add: `*.financely.app/*` → `financely-sites-worker`
4. **Test with a new site** - it should work automatically!


