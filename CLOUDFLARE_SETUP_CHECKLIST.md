# Cloudflare Setup - Step-by-Step Checklist

Follow these steps in order to set up Cloudflare hosting for Financely brand sites.

## Prerequisites

- [ ] Cloudflare account created
- [ ] `wrangler` CLI installed: `npm install -g wrangler`
- [ ] Logged into Cloudflare: `wrangler login`
- [ ] Firebase CLI installed and authenticated

---

## Step 1: Create Cloudflare Resources

### 1.1 Create R2 Bucket

```bash
wrangler r2 bucket create financely-sites
```

**Expected output:** Confirmation that bucket was created

**Verify:**
```bash
wrangler r2 bucket list
```
You should see `financely-sites` in the list.

---

### 1.2 Create KV Namespace

```bash
wrangler kv namespace create "SITE_HOSTS"
```

**Note:** In wrangler v4+, use spaces (`kv namespace`) instead of colons (`kv:namespace`).

**Expected output:**
```
🌀  Creating namespace with title "SITE_HOSTS"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SITE_HOSTS", id = "abc123def456..." }
```

**IMPORTANT:** Copy the `id` value (the long string) - you'll need it in Step 2.

**Verify:**
```bash
wrangler kv namespace list
```
You should see `SITE_HOSTS` with the ID you just copied.

---

### 1.3 Create Preview KV Namespace (Optional but Recommended)

```bash
wrangler kv namespace create "SITE_HOSTS" --preview
```

**Expected output:**
```
🌀  Creating namespace with title "SITE_HOSTS_preview"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SITE_HOSTS", preview_id = "xyz789..." }
```

**IMPORTANT:** Copy the `preview_id` value - you'll need it in Step 2.

---

## Step 2: Configure Worker

### 2.1 Update `wrangler.toml`

Open `cloudflare-worker/wrangler.toml` and replace the placeholder values:

```toml
[[kv_namespaces]]
binding = "SITE_HOSTS"
id = "YOUR_KV_NAMESPACE_ID"  # ← Replace with ID from Step 1.2
preview_id = "YOUR_KV_PREVIEW_NAMESPACE_ID"  # ← Replace with preview_id from Step 1.3

[[r2_buckets]]
binding = "SITES_BUCKET"
bucket_name = "financely-sites"  # ← Should match bucket name from Step 1.1
```

**Example after update:**
```toml
[[kv_namespaces]]
binding = "SITE_HOSTS"
id = "abc123def456ghi789jkl012mno345pqr678"
preview_id = "xyz789abc123def456ghi789jkl012"

[[r2_buckets]]
binding = "SITES_BUCKET"
bucket_name = "financely-sites"
```

---

### 2.2 Install Dependencies

```bash
cd cloudflare-worker
npm install
```

**Expected output:** Dependencies installed successfully

---

### 2.3 Deploy Worker

```bash
wrangler deploy
```

**Expected output:**
```
✨  Compiled Worker successfully
✨  Successfully published your Worker to the following routes:
  - financely-sites-worker.your-subdomain.workers.dev
```

**Note the Worker URL** - you'll need it for DNS configuration.

---

## Step 3: Get Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account (if you have multiple)
3. Look at the right sidebar - you'll see **Account ID**
4. **Copy this value** - you'll need it in Step 4

**Alternative method:**
```bash
wrangler whoami
```
This shows your account details, but Account ID is easier to find in the dashboard.

---

## Step 4: Create Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Click **"Edit Cloudflare Workers"** template (or create custom)
4. Configure permissions:
   - **Account** → **Cloudflare R2** → **Edit**
   - **Account** → **Workers KV Storage** → **Edit**
5. Set **Account Resources** to your account
6. Click **"Continue to summary"** → **"Create Token"**
7. **Copy the token immediately** (you won't see it again!)

**IMPORTANT:** Save this token securely - you'll need it in Step 5.

---

## Step 5: Configure Firebase Secrets

Run these commands one by one. Each will prompt you to enter the value:

```bash
# 1. Account ID (from Step 3)
firebase functions:secrets:set CLOUDFLARE_ACCOUNT_ID
# When prompted, paste your Account ID

# 2. API Token (from Step 4)
firebase functions:secrets:set CLOUDFLARE_API_TOKEN
# When prompted, paste your API Token

# 3. R2 Bucket Name
firebase functions:secrets:set CLOUDFLARE_R2_BUCKET_NAME
# When prompted, enter: financely-sites

# 4. KV Namespace ID (from Step 1.2)
firebase functions:secrets:set CLOUDFLARE_KV_NAMESPACE_ID
# When prompted, paste the KV namespace ID
```

**Verify secrets are set:**
```bash
firebase functions:secrets:access CLOUDFLARE_ACCOUNT_ID
firebase functions:secrets:access CLOUDFLARE_API_TOKEN
firebase functions:secrets:access CLOUDFLARE_R2_BUCKET_NAME
firebase functions:secrets:access CLOUDFLARE_KV_NAMESPACE_ID
```

Each command should show the value you set (except the token, which will be masked).

---

## Step 6: Deploy Firebase Functions

```bash
cd functions
npm install  # If you haven't already
npm run build
firebase deploy --only functions:publishBrandSite
```

**Expected output:** Function deployed successfully

**Verify function exists:**
```bash
firebase functions:list
```
You should see `publishBrandSite` in the list.

---

## Step 7: Test the Setup

### 7.1 Test Publishing a Site

You can test using the Firebase Functions console or from your app:

**Option A: Using Firebase Console**
1. Go to Firebase Console → Functions
2. Find `publishBrandSite`
3. Click "Test" and provide:
   ```json
   {
     "brandSiteId": "test-brand-123",
     "html": "<html><body><h1>Test Site</h1></body></html>",
     "sourceType": "manual"
   }
   ```

**Option B: From Your App**
Use the `usePublishBrandSite` hook in your React app.

### 7.2 Verify R2 Upload

```bash
wrangler r2 object list financely-sites --prefix="sites/test-brand-123/"
```

You should see `index.html` in the output.

### 7.3 Verify KV Mapping

```bash
wrangler kv key get --namespace-id=YOUR_KV_NAMESPACE_ID "test-domain.com"
```

**Note:** In wrangler v4+, use `kv key` instead of `kv:key`.

If you set a domain mapping, you should see: `test-brand-123:v1234567890-abc123`

---

## Step 8: Configure DNS (For Each Domain)

### Option A: Workers Routes (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain
3. Go to **Workers & Pages** → **Routes**
4. Click **"Add route"**
5. Enter:
   - **Route:** `example.com/*`
   - **Service:** `financely-sites-worker`
6. Click **"Save"**

### Option B: CNAME (Alternative)

1. Go to your domain's DNS settings in Cloudflare
2. Add a CNAME record:
   - **Name:** `@` (or subdomain)
   - **Target:** `financely-sites-worker.your-subdomain.workers.dev`
   - **Proxy status:** Proxied (orange cloud)

---

## Step 9: Update Your Code (Optional - For New Sites)

If you want new sites to automatically use Cloudflare instead of Firebase Hosting:

1. Update `handle-generate-site.ts` to call `publishBrandSite` after AI generation
2. Update `deploy-manual-site.ts` to use Cloudflare publisher
3. Update site builder UI to show Cloudflare status

**Note:** This is optional - you can test with the `publishBrandSite` function first before making these changes.

---

## Verification Checklist

After completing all steps, verify:

- [ ] R2 bucket exists and is accessible
- [ ] KV namespace exists and is accessible
- [ ] Worker deployed successfully
- [ ] Firebase secrets configured
- [ ] `publishBrandSite` function deployed
- [ ] Can publish a test site
- [ ] Files appear in R2
- [ ] KV mapping works
- [ ] Worker serves content (if DNS configured)

---

## Troubleshooting

### "Worker deployment failed"
- Check `wrangler.toml` has correct IDs
- Verify you're logged in: `wrangler whoami`
- Check Worker name doesn't conflict with existing Workers

### "Secret not found" error
- Verify secrets are set: `firebase functions:secrets:access SECRET_NAME`
- Make sure you're in the correct Firebase project
- Redeploy functions after setting secrets

### "R2 upload failed"
- Verify API token has R2 permissions
- Check bucket name matches exactly
- Verify account ID is correct

### "KV update failed"
- Verify API token has KV permissions
- Check namespace ID is correct
- Ensure namespace exists: `wrangler kv namespace list`

### "Worker returns 404"
- Check KV has mapping: `wrangler kv key get --namespace-id=ID "domain.com"`
- Verify R2 has files: `wrangler r2 object list financely-sites --prefix="sites/..."`
- Check DNS is pointing to Worker correctly

---

## Next Steps After Setup

1. **Test with a real brand site** from your app
2. **Monitor Cloudflare dashboard** for usage and errors
3. **Update site builder** to use Cloudflare (optional)
4. **Migrate existing sites** gradually (see migration guide)

---

## Quick Reference

| Resource | Command to Check |
|----------|------------------|
| R2 Buckets | `wrangler r2 bucket list` |
| KV Namespaces | `wrangler kv:namespace list` |
| Workers | `wrangler deployments list` |
| R2 Objects | `wrangler r2 object list financely-sites` |
| KV Keys | `wrangler kv:key list --namespace-id=ID` |
| Firebase Secrets | `firebase functions:secrets:access SECRET_NAME` |

---

## Need Help?

- **Cloudflare Docs:** https://developers.cloudflare.com/workers/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/
- **Firebase Secrets:** https://firebase.google.com/docs/functions/config-env

