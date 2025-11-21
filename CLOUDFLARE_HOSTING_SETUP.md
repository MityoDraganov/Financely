# Cloudflare Multi-Tenant Site Hosting Setup

This document describes the migration from Firebase Hosting to Cloudflare for serving brand sites in Financely.

## Architecture Overview

### Before (Firebase Hosting)
- One Firebase Hosting site per brand → hitting quota limits
- Each site requires separate Firebase Hosting resource
- Operational overhead for managing thousands of sites

### After (Cloudflare)
- **Single Cloudflare Worker** serves all brand sites dynamically
- **Cloudflare R2** stores static assets (HTML, CSS, JS, images)
- **Cloudflare KV** maps hostnames to `brandSiteId:versionId`
- **Firebase** remains the control plane (app, data, AI builder)

## Components

### 1. Cloudflare Worker (`cloudflare-worker/src/index.ts`)
- Reads `Host` header to identify which brand site to serve
- Looks up `hostname -> brandSiteId:versionId` in KV
- Fetches static assets from R2
- Returns content with caching headers

### 2. Cloudflare Publisher Service (`functions/src/services/cloudflare-publisher-service.ts`)
- Uploads HTML and assets to R2
- Updates KV namespace with hostname mappings
- Used by `publishBrandSite` Firebase Function

### 3. Publisher Function (`functions/src/functions/publish-brand-site.ts`)
- Firebase Function endpoint: `publishBrandSite`
- Validates authentication/authorization
- Generates versionId
- Uploads to R2 via CloudflarePublisherService
- Creates Firestore version document
- Updates KV mappings

## Setup Instructions

### Step 1: Create Cloudflare Resources

1. **Create R2 Bucket:**
   ```bash
   wrangler r2 bucket create financely-sites
   ```

2. **Create KV Namespace:**
   ```bash
   wrangler kv:namespace create "SITE_HOSTS"
   ```
   Note the `id` from the output (you'll need it for `wrangler.toml`)

3. **Create Preview KV Namespace (optional):**
   ```bash
   wrangler kv:namespace create "SITE_HOSTS" --preview
   ```

### Step 2: Configure Worker

1. **Update `cloudflare-worker/wrangler.toml`:**
   - Replace `YOUR_KV_NAMESPACE_ID` with the actual namespace ID
   - Replace `YOUR_KV_PREVIEW_NAMESPACE_ID` with preview namespace ID (if using)
   - Verify `bucket_name` matches your R2 bucket name

2. **Deploy Worker:**
   ```bash
   cd cloudflare-worker
   npm install
   wrangler deploy
   ```

### Step 3: Configure Firebase Functions Secrets

Add the following secrets to Firebase Secret Manager:

```bash
firebase functions:secrets:set CLOUDFLARE_ACCOUNT_ID
firebase functions:secrets:set CLOUDFLARE_API_TOKEN
firebase functions:secrets:set CLOUDFLARE_R2_BUCKET_NAME
firebase functions:secrets:set CLOUDFLARE_KV_NAMESPACE_ID
```

**Values:**
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in Cloudflare dashboard)
- `CLOUDFLARE_API_TOKEN`: API token with permissions:
  - `Account:Cloudflare R2:Edit`
  - `Account:Workers KV Storage:Edit`
- `CLOUDFLARE_R2_BUCKET_NAME`: `financely-sites` (or your bucket name)
- `CLOUDFLARE_KV_NAMESPACE_ID`: The KV namespace ID from Step 1

### Step 4: Configure DNS

For each brand site domain:
1. Add domain to Cloudflare (if not already managed)
2. Point DNS to your Cloudflare Worker:
   - **Option A**: Use Cloudflare Workers Routes (recommended)
     - In Cloudflare dashboard: Workers & Pages → Routes
     - Add route: `example.com/*` → `financely-sites-worker`
   - **Option B**: Use CNAME to Worker subdomain
     - Create CNAME: `example.com` → `financely-sites-worker.your-subdomain.workers.dev`

## Data Model Changes

### BrandSite Entity Updates

New fields added:
- `currentVersionId?: string` - Reference to latest live version in Cloudflare
- `primaryDomain?: string` - Primary domain (e.g., "acme-finance.com")
- `altDomains?: string[]` - Additional domains (e.g., ["www.acme-finance.com"])
- `hostingProvider: "firebase" | "cloudflare"` - Tracks which hosting provider is used

### BrandSiteVersion Updates

New fields added:
- `versionId?: string` - Cloudflare version ID (e.g., "v1234567890-abc123")
- `sourceType?: "ai-builder" | "manual" | "imported"` - How version was created
- `aiPrompt?: string` - AI prompt used (if applicable)
- `notes?: string` - User notes
- `layoutConfig?: unknown` - Optional layout config
- `createdByUserId?: string` - User who created this version

## Storage Layout

### R2 Bucket Structure
```
sites/
  {brandSiteId}/
    {versionId}/
      index.html
      assets/
        style.css
        script.js
        image.png
        ...
```

### KV Namespace Structure
- **Key**: Hostname (e.g., `acme-finance.com`)
- **Value**: `brandSiteId:versionId` (e.g., `brand-123:v1704067200-abc123`)

## Migration Strategy

### Phase 1: Parallel Operation (Current)
- New sites can use Cloudflare via `publishBrandSite`
- Existing sites continue on Firebase Hosting
- Both systems operate in parallel

### Phase 2: Gradual Migration
- Migrate existing sites to Cloudflare:
  1. Export HTML/assets from Firebase Hosting
  2. Call `publishBrandSite` with exported content
  3. Update DNS to point to Cloudflare Worker
  4. Update `hostingProvider` field to `"cloudflare"`

### Phase 3: Full Migration
- All new sites use Cloudflare
- All existing sites migrated
- Firebase Hosting code can be deprecated (but kept for rollback)

## API Usage

### Publishing a Site

```typescript
import { functionsService } from "@/services/functions/functions-service";

const result = await functionsService.publishBrandSite({
  brandSiteId: "brand-123",
  html: "<html>...</html>",
  assets: [
    {
      path: "assets/style.css",
      content: "body { color: red; }",
      contentType: "text/css",
    },
  ],
  sourceType: "ai-builder",
  aiPrompt: "Create a modern finance website",
  notes: "Initial AI-generated site",
});
```

### Frontend Hook

```typescript
import { usePublishBrandSite } from "@/hooks/service-hooks/use-brand-site";

const publishSite = usePublishBrandSite();

publishSite.mutate({
  brandSiteId: "brand-123",
  html: siteHtml,
  assets: siteAssets,
  sourceType: "manual",
});
```

## Troubleshooting

### Worker Returns 404
- Check KV namespace has correct mapping: `wrangler kv:key get --namespace-id=YOUR_ID "example.com"`
- Verify R2 bucket has files: `wrangler r2 object list financely-sites --prefix="sites/brand-123/"`

### Upload Fails
- Verify API token has correct permissions
- Check account ID is correct
- Ensure bucket name matches exactly

### DNS Not Working
- Verify domain is added to Cloudflare
- Check Worker route is configured
- Wait for DNS propagation (can take up to 48 hours)

## Performance Considerations

- **Caching**: Worker sets `Cache-Control: public, max-age=300` (5 minutes)
- **R2 Performance**: R2 is optimized for read-heavy workloads
- **KV Performance**: KV lookups are fast (< 1ms typically)
- **Worker Limits**: 50ms CPU time per request (sufficient for static file serving)

## Cost Considerations

### Cloudflare Pricing (as of 2024)
- **Workers**: $5/month for 10M requests, then $0.50 per million
- **R2**: $0.015/GB storage, $0.36/GB egress (first 10GB free)
- **KV**: $0.50 per million reads, $5 per million writes

### Comparison to Firebase Hosting
- Firebase Hosting: Limited sites per project (quota issues)
- Cloudflare: Unlimited sites, pay per usage
- More cost-effective at scale (thousands of sites)

## Security

- **Authentication**: `publishBrandSite` validates user authentication
- **Authorization**: Verify user has permission to publish (TODO: implement)
- **API Tokens**: Store in Firebase Secret Manager, never commit
- **CORS**: Worker sets permissive CORS (adjust based on requirements)

## Future Enhancements

- [ ] Preview versions via query param (e.g., `?preview=versionId`)
- [ ] Custom 404 pages per brand
- [ ] Edge caching with Cloudflare Cache API
- [ ] Analytics integration
- [ ] A/B testing support
- [ ] Rollback functionality

