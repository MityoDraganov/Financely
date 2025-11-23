# Error 522 Diagnosis & Fix

## Current Status
✅ Worker deployed successfully
✅ KV mapping exists: `bloomora.financely.app` → `G7HdYgc3luiazvp7qmoD:v1763744318049-ievh9ku`
✅ R2 files exist (we saw them in the dashboard)
✅ Worker bindings are correct

## Error 522: Connection Timed Out

This means Cloudflare can't reach the Worker or the Worker is timing out.

## Most Likely Cause: Missing Wildcard Route

The wildcard route `*.financely.app/*` → `financely-sites-worker` might not be configured.

### Check & Fix Route Configuration

1. **Go to Cloudflare Dashboard:**
   - https://dash.cloudflare.com/
   - Select your account
   - Go to **Workers & Pages** → **Routes**

2. **Check if route exists:**
   - Look for: `*.financely.app/*` → `financely-sites-worker`
   - If it doesn't exist, add it:
     - Click **"Add route"**
     - **Route:** `*.financely.app/*`
     - **Service:** `financely-sites-worker`
     - Click **"Save"**

3. **Verify DNS:**
   - Go to **DNS** for `financely.app`
   - Check if `bloomora` CNAME exists
   - Should point to: `financely-sites-worker.mityodraganow.workers.dev`
   - Should be **Proxied** (orange cloud)

## Test the Worker Directly

Test if the Worker works when accessed directly:

```bash
curl -H "Host: bloomora.financely.app" https://financely-sites-worker.mityodraganow.workers.dev/
```

If this works, the issue is routing. If it doesn't, check Worker logs.

## Check Worker Logs

View real-time Worker logs:

```bash
cd cloudflare-worker
wrangler tail --format pretty
```

Then visit `https://bloomora.financely.app` and watch the logs to see what's happening.

## Alternative: Test with Direct Worker URL

Try accessing the Worker directly with the host header:

```bash
curl -H "Host: bloomora.financely.app" \
  https://financely-sites-worker.mityodraganow.workers.dev/
```

This bypasses DNS/routing and tests the Worker directly.

## Quick Checklist

- [ ] Wildcard route `*.financely.app/*` → `financely-sites-worker` exists
- [ ] DNS CNAME `bloomora` → Worker subdomain exists and is proxied
- [ ] Worker logs show requests coming in
- [ ] Direct Worker URL test works


