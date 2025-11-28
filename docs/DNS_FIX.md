# DNS Fix for bloomora.financely.app

## Problem
The DNS record for `bloomora.financely.app` doesn't exist, causing "DNS address could not be found" error.

## Solution: Create DNS CNAME Record

### Option 1: Via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard:**
   - https://dash.cloudflare.com/
   - Select your account
   - Click on the **`financely.app`** domain (not the Worker)

2. **Go to DNS:**
   - In the left sidebar, click **"DNS"**
   - Click **"Add record"**

3. **Create CNAME Record:**
   - **Type:** `CNAME`
   - **Name:** `bloomora`
   - **Target:** `financely-sites-worker.mityodraganow.workers.dev`
   - **Proxy status:** ✅ **Proxied** (orange cloud) - **IMPORTANT!**
   - **TTL:** Auto
   - Click **"Save"**

4. **Wait 1-2 minutes** for DNS propagation

5. **Test:** Visit `https://bloomora.financely.app`

### Option 2: Via Wrangler CLI

```bash
# This requires Cloudflare API with DNS permissions
# Not recommended - use Dashboard instead
```

## Why This Is Needed

The automated DNS creation in the code might have failed due to:
- API token permissions
- Zone ID mismatch
- Network issues during deployment

## After DNS Is Created

Once the DNS record exists:
1. DNS will resolve `bloomora.financely.app` → Worker
2. Cloudflare will route to Worker (if wildcard route is configured)
3. Worker will look up KV mapping
4. Worker will serve files from R2
5. Site will load! ✅

## Verify DNS

After creating the record, verify:

```bash
dig bloomora.financely.app +short
```

Should return: `financely-sites-worker.mityodraganow.workers.dev` or a Cloudflare IP (if proxied)

## Next Steps

1. ✅ Create DNS CNAME record (above)
2. ✅ Verify wildcard route exists: `*.financely.app/*` → `financely-sites-worker`
3. ✅ Test the site


