# Fix API Token DNS Permissions

## Problem

DNS records are not being created automatically because the Cloudflare API token lacks DNS write permissions.

## Solution: Update API Token Permissions

### Step 1: Check Current Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Find the token you're using (check `CLOUDFLARE_API_TOKEN` secret)
3. Note which token it is

### Step 2: Update Token Permissions

**Option A: Edit Existing Token**
1. Click "Edit" on your token
2. Add these permissions:
   - ✅ `Zone:Zone:Read`
   - ✅ `Zone:Zone:Edit`
   - ✅ `Zone:DNS:Read`
   - ✅ `Zone:DNS:Edit`
3. Save

**Option B: Create New Token (Recommended)**
1. Click "Create Token"
2. Use "Edit zone DNS" template OR create custom:
   - **Permissions:**
     - `Zone:Zone:Read`
     - `Zone:Zone:Edit`
     - `Zone:DNS:Read`
     - `Zone:DNS:Edit`
     - `Account:Cloudflare R2:Edit`
     - `Account:Workers KV Storage:Edit`
   - **Zone Resources:** Include `financely.app`
3. Copy the token
4. Update Firebase secret:
   ```bash
   firebase functions:secrets:set CLOUDFLARE_API_TOKEN
   # Paste the new token when prompted
   ```
5. Redeploy functions:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions:onBrandSiteCreated,functions:onBrandSiteUpdated
   ```

### Step 3: Verify

After updating permissions, generate a new site and check:
1. Firebase logs show "DNS record verified" (not just "created")
2. Cloudflare Dashboard → DNS shows the CNAME record
3. Site loads without DNS errors

## Why This Happens

The code calls `createSubdomain()` which uses the Cloudflare API. If the token doesn't have `Zone:DNS:Edit` permission, the API call might:
- Return success but not actually create the record
- Return 403 Forbidden
- Fail silently

The verification step I added will now catch this and fail with a clear error message.

