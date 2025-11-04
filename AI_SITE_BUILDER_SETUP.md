# AI Site Builder Setup Guide

This guide explains how to set up and configure the AI Site Builder feature, which generates branded websites automatically using Gemini AI, Firebase Hosting, and Cloudflare.

## 📋 Prerequisites

1. **Firebase Project** with Blaze plan (required for multi-site hosting)
2. **Cloudflare Account** with your domain added
3. **Google AI Studio API Key** for Gemini 1.5 Flash
4. **Firebase CLI** installed and authenticated

## 🔐 Step 1: Configure Google Cloud Secret Manager

### 1.1 Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com
```

### 1.2 Create Required Secrets

```bash
# Get your project ID
PROJECT_ID=$(gcloud config get-value project)

# Create Gemini API Key secret
# Get your API key from: https://makersuite.google.com/app/apikey
echo "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Create Cloudflare API Token secret
# Create token at: https://dash.cloudflare.com/profile/api-tokens
# Permissions needed: Zone:DNS:Edit
echo "YOUR_CLOUDFLARE_API_TOKEN" | gcloud secrets create CLOUDFLARE_API_TOKEN --data-file=-

# Create Cloudflare Zone ID secret
# Find your Zone ID in Cloudflare dashboard > Domain Overview
echo "YOUR_CLOUDFLARE_ZONE_ID" | gcloud secrets create CLOUDFLARE_ZONE_ID --data-file=-

# Create Cloudflare Base Domain secret
echo "financely.app" | gcloud secrets create CLOUDFLARE_BASE_DOMAIN --data-file=-

# Create Firebase Project ID secret
echo "$PROJECT_ID" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
```

### 1.3 Grant Permissions

```bash
# Get your project ID first
PROJECT_ID=$(gcloud config get-value project)

# Grant Secret Manager Secret Accessor role to Firebase Functions service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

**Note:** If `$PROJECT_ID` is not set, you can also run it as a single command:
```bash
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
    --member="serviceAccount:$(gcloud config get-value project)@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 🌐 Step 2: Configure Cloudflare

### 2.1 Get Your Cloudflare Credentials

1. **API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit zone DNS" template
   - Select your zone (financely.app)
   - Copy the token

2. **Zone ID:**
   - Go to Cloudflare Dashboard > Your Domain
   - Scroll down to find "Zone ID" in the right sidebar
   - Copy the Zone ID

3. **Domain:**
   - Ensure your domain (financely.app) is added to Cloudflare
   - DNS should be managed by Cloudflare (orange cloud enabled)

## 🤖 Step 3: Get Gemini API Key

1. Go to https://makersuite.google.com/app/apikey (or https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (starts with `AIza...`)
5. **Important**: The code uses `gemini-2.5-flash` model (stable version). Available models:
   - `gemini-2.5-flash` (stable, recommended) ✅
   - `gemini-2.5-flash-preview-05-20` (preview)
   - `gemini-2.5-pro-preview-03-25` (preview, for complex tasks)
6. Ensure the Generative Language API is enabled in your Google Cloud project

## 🔧 Step 3.5: Enable Firebase Hosting API

Before deploying, ensure the Firebase Hosting API is enabled:

```bash
# Enable Firebase Hosting API
gcloud services enable firebasehosting.googleapis.com --project=$(gcloud config get-value project)
```

Verify it's enabled:
```bash
gcloud services list --enabled --filter="firebasehosting.googleapis.com"
```

## 🚀 Step 4: Install Dependencies and Deploy

### 4.1 Install Backend Dependencies

```bash
cd functions
npm install
```

This will install:
- `google-auth-library` for Firebase Hosting API authentication
- Other existing dependencies

### 4.2 Build and Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 4.3 Verify Deployment

Check that all functions are deployed:

```bash
firebase functions:list
```

You should see:
- `generateSite`
- `regenerateSite`
- `addCustomDomain`

## 📝 Step 5: Configure Firebase Hosting (Multi-Site)

### 5.1 Enable Firebase Hosting API

```bash
gcloud services enable firebasehosting.googleapis.com
```

### 5.2 Create Hosting Sites (Optional)

Sites are created automatically by the function, but you can pre-create them:

```bash
# List existing sites
firebase hosting:sites:list

# Create a site manually (optional - functions do this automatically)
firebase hosting:sites:create brand-site-id
```

## 🧪 Step 6: Test the Integration

### 6.1 Test from Frontend

1. Go to Settings > Organization > Branding
2. Configure your branding (logo, colors, company name)
3. Click "Generate Site"
4. Wait for generation (usually 30-60 seconds)
5. Your site will be available at: `{brand-name}.financely.app`

### 6.2 Test Custom Domain

1. After generating a site, enter a custom domain
2. Click "Add Domain"
3. Configure DNS records as instructed
4. Wait for DNS propagation (can take up to 48 hours)

## 🔍 Troubleshooting

### Common Issues

1. **"Secret not found" error**
   - Ensure secrets are created in Secret Manager
   - Verify service account has `secretmanager.secretAccessor` role
   - Check secret names match exactly (case-sensitive)

2. **"Cloudflare API error"**
   - Verify API token has correct permissions
   - Check Zone ID is correct
   - Ensure domain is managed by Cloudflare

3. **"Firebase Hosting API error"**
   - Ensure Firebase Hosting API is enabled
   - Check project ID is correct
   - Verify service account has hosting permissions

4. **"Gemini API error"**
   - Verify API key is valid
   - Check API quota hasn't been exceeded
   - Ensure API key has access to Gemini 1.5 Flash

5. **Site not deploying**
   - Check Firebase Functions logs: `firebase functions:log`
   - Verify site was created in Firebase Hosting
   - Check Cloudflare DNS records were created

### Debug Commands

```bash
# View function logs
firebase functions:log --only generateSite

# Check secret access
gcloud secrets versions access latest --secret="GEMINI_API_KEY"

# List Firebase Hosting sites
firebase hosting:sites:list

# Check Cloudflare DNS records
# (Use Cloudflare dashboard or API)
```

## 📊 Monitoring

### Function Logs

```bash
# View all brand site function logs
firebase functions:log | grep -E "(generateSite|regenerateSite|addCustomDomain)"

# View specific function logs
firebase functions:log --only generateSite
```

### Cloudflare Dashboard

- Monitor DNS record creation
- Check subdomain status
- View DNS propagation status

### Firebase Console

- View hosting sites: https://console.firebase.google.com/project/YOUR_PROJECT/hosting
- Check function executions: https://console.firebase.google.com/project/YOUR_PROJECT/functions

## 🔒 Security Best Practices

1. **Never commit secrets** - All secrets are in Secret Manager
2. **Rotate API keys regularly** - Update secrets in Secret Manager
3. **Use least privilege** - API tokens should have minimal required permissions
4. **Monitor access** - Check Secret Manager audit logs
5. **Validate domains** - Ensure custom domains are verified before linking

## 📚 API Reference

### generateSite

**Input:**
```typescript
{
  organizationId: string;
  brandName?: string;
  tone?: string;
}
```

**Output:**
```typescript
{
  id: string;      // Brand site ID
  url: string;     // Deployed site URL
  status: string; // "success" | "failed"
}
```

### regenerateSite

**Input:**
```typescript
{
  brandSiteId: string;
  sectionType?: "hero" | "about" | "features" | "contact";
}
```

**Output:**
```typescript
{
  success: boolean;
  brandSiteId: string;
}
```

### addCustomDomain

**Input:**
```typescript
{
  brandSiteId: string;
  customDomain: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  customDomain: string;
}
```

## 🎯 Next Steps

1. **Monitor usage** - Track site generation metrics
2. **Optimize prompts** - Refine Gemini prompts for better results
3. **Add templates** - Create site templates for different industries
4. **Custom sections** - Allow users to customize specific sections
5. **Analytics** - Add analytics to generated sites
6. **A/B testing** - Test different AI prompts and configurations

## 📞 Support

For issues or questions:
1. Check function logs: `firebase functions:log`
2. Review Secret Manager access logs
3. Verify Cloudflare DNS records
4. Check Firebase Hosting sites list

## ✅ Checklist

- [ ] Secret Manager API enabled
- [ ] All secrets created (GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, etc.)
- [ ] Service account has secretmanager.secretAccessor role
- [ ] Cloudflare API token created with DNS:Edit permissions
- [ ] Cloudflare Zone ID obtained
- [ ] Gemini API key obtained
- [ ] Firebase Hosting API enabled
- [ ] Functions deployed successfully
- [ ] Test site generation from frontend
- [ ] Verify site is accessible at subdomain
- [ ] Test custom domain addition (optional)

## 🎉 You're Done!

Your AI Site Builder is now fully configured and ready to use. Users can generate branded websites with a single click!

