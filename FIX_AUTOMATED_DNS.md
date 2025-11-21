# Fix Automated DNS Creation

## Problem

The code should automatically create DNS records, but they're not being created. The logs show "Cloudflare subdomain DNS created" but the DNS record doesn't exist.

## Root Causes

1. **API Token Missing DNS Permissions**
   - The token needs: `Zone:Zone:Edit` and `Zone:DNS:Edit`
   - Check: Cloudflare Dashboard → Profile → API Tokens

2. **Wrong Zone ID**
   - The `CLOUDFLARE_ZONE_ID` secret might be wrong
   - Verify: Cloudflare Dashboard → `financely.app` → Overview → Zone ID

3. **Silent API Failures**
   - The API call might succeed but not actually create the record
   - Need better error handling and verification

## Fix: Verify API Token Permissions

1. **Go to Cloudflare Dashboard:**
   - https://dash.cloudflare.com/profile/api-tokens

2. **Find your API token** (the one used in `CLOUDFLARE_API_TOKEN` secret)

3. **Verify it has these permissions:**
   - ✅ `Zone:Zone:Read`
   - ✅ `Zone:Zone:Edit`
   - ✅ `Zone:DNS:Read`
   - ✅ `Zone:DNS:Edit`
   - ✅ `Account:Cloudflare R2:Edit`
   - ✅ `Account:Workers KV Storage:Edit`

4. **If missing, either:**
   - Update the existing token to add DNS permissions
   - Create a new token with all required permissions
   - Update the `CLOUDFLARE_API_TOKEN` secret

## Fix: Verify Zone ID

1. **Go to Cloudflare Dashboard:**
   - Select `financely.app` domain
   - Go to Overview
   - Copy the **Zone ID** (right sidebar)

2. **Verify the secret:**
   ```bash
   firebase functions:secrets:access CLOUDFLARE_ZONE_ID
   ```

3. **Should match the Zone ID from dashboard**

## Fix: Add DNS Verification

The code should verify the DNS record was actually created. Let me add that.

## Test After Fix

After fixing permissions/Zone ID, regenerate a site and check:
1. Firebase Function logs show DNS creation succeeded
2. Cloudflare Dashboard → DNS shows the CNAME record
3. `dig bloomora.financely.app` returns the record

