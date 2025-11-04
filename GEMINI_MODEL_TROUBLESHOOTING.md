# Gemini API 404 Error - Troubleshooting Guide

If you're getting a "404 Not Found" error when generating sites, follow these steps:

## Quick Fix

The model name `gemini-1.5-flash` has been deprecated. The code now uses `gemini-2.5-flash` (stable version) by default.

## Common Causes

### 1. Model Name Issue

The model name might be incorrect or deprecated. Try these alternatives:

**Option A: Use stable 2.5 Flash model (Recommended)**
```typescript
model: "gemini-2.5-flash"
```

**Option B: Use preview 2.5 Flash model**
```typescript
model: "gemini-2.5-flash-preview-05-20"
```

**Option C: Use 2.5 Pro preview (for complex tasks)**
```typescript
model: "gemini-2.5-pro-preview-03-25"
```

### 2. API Key Issues

1. **Verify API Key is valid:**
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=YOUR_API_KEY"
   ```
   
2. **List all available models:**
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
   ```

2. **Check API Key permissions:**
   - Ensure the API key has access to Generative Language API
   - Verify billing is enabled on your Google Cloud project

3. **Regenerate API Key if needed:**
   - Go to https://aistudio.google.com/app/apikey
   - Create a new API key
   - Update the secret in Secret Manager:
     ```bash
     echo "YOUR_NEW_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
     ```

### 3. API Not Enabled

Enable the Generative Language API:
```bash
gcloud services enable generativelanguage.googleapis.com
```

### 4. Check Available Models

List available models for your API key:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

## How to Update the Model

If you need to change the model, update these files:

1. **`functions/src/services/gemini-service.ts`** - Default model in constructor
2. **`functions/src/app/handle-generate-site.ts`** - Model used for generation
3. **`functions/src/functions/regenerate-site.ts`** - Model used for regeneration

## Testing the Fix

After updating:

1. **Rebuild functions:**
   ```bash
   cd functions
   npm run build
   ```

2. **Redeploy:**
   ```bash
   firebase deploy --only functions:generateSite
   ```

3. **Test from UI:**
   - Go to Settings > Organization > Branding
   - Click "Generate Site"
   - Check function logs if it fails:
     ```bash
     firebase functions:log --only generateSite
     ```

## Error Logging

The updated code now provides better error messages. Check the function logs to see:
- The exact model name being used
- The full error response from Gemini API
- The API endpoint being called

## Alternative: Use Vertex AI

If the REST API continues to have issues, consider switching to Vertex AI:
- Requires different authentication (service account)
- Different endpoint format
- More complex setup but more reliable for production

## Still Having Issues?

1. Check Google Cloud Console for API quota limits
2. Verify your project has billing enabled
3. Check if the model is available in your region
4. Review Firebase Functions logs for detailed error messages

