# KV Mapping Fix - Error 522

## Problem

The site was deployed successfully (files in R2 ✅), but the **KV mapping is missing**. This causes Error 522 because the Worker can't find which site to serve.

## Root Cause

The `updateSiteHostMapping` call in `handle-generate-site.ts` is completing without errors, but the KV entry isn't actually being created. Possible causes:

1. **Wrong KV Namespace ID** - The secret might have the wrong ID
2. **API Token Permissions** - Token might not have KV write permissions
3. **API Endpoint Issue** - The Cloudflare API call might be failing silently

## Quick Fix (Manual)

Manually create the KV mapping:

```bash
# Use the remote flag to write to production KV
wrangler kv key put \
  --namespace-id=c989958d896c45fdababde535507edd3 \
  --remote \
  "bloomora.financely.app" \
  "G7HdYgc3luiazvp7qmoD:v1763744318049-ievh9ku"
```

Then verify:
```bash
wrangler kv key get \
  --namespace-id=c989958d896c45fdababde535507edd3 \
  --remote \
  "bloomora.financely.app"
```

Should return: `G7HdYgc3luiazvp7qmoD:v1763744318049-ievh9ku`

## Verify Secrets

Check that the KV namespace ID secret is correct:

```bash
firebase functions:secrets:access CLOUDFLARE_KV_NAMESPACE_ID
```

Should return: `c989958d896c45fdababde535507edd3`

## Check API Token Permissions

The API token needs:
- `Account:Workers KV Storage:Edit`

Verify in Cloudflare Dashboard → Profile → API Tokens

## After Manual Fix

Once the KV mapping is created manually, the site should work immediately. Then we need to fix the automated flow to ensure KV updates actually work.

## Debugging the Automated Flow

To debug why the automated KV update isn't working:

1. Check Firebase Function logs for KV update errors
2. Verify the API token has KV write permissions
3. Test the API call manually with curl:

```bash
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/storage/kv/namespaces/c989958d896c45fdababde535507edd3/values/bloomora.financely.app" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: text/plain" \
  -d "G7HdYgc3luiazvp7qmoD:v1763744318049-ievh9ku"
```


