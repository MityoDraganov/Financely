# Invoice Extraction System - Setup Guide

## Overview

This guide will help you set up and test the invoice extraction system using Google Cloud Vision API.

## Prerequisites

1. **Firebase Project** with Cloud Functions enabled
2. **Google Cloud Project** (same as Firebase project)
3. **Node.js 22** installed
4. **Firebase CLI** installed

## Step 1: Install Dependencies

```bash
cd functions
npm install
```

This will install `@google-cloud/vision` and other required dependencies.

## Step 2: Enable Google Cloud Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Vision API"
5. Click **Enable**

Alternatively, use gcloud CLI:
```bash
gcloud services enable vision.googleapis.com --project=YOUR_PROJECT_ID
```

## Step 3: Configure Service Account Permissions

The Firebase Functions service account needs Vision API access:

1. Go to **IAM & Admin** > **Service Accounts**
2. Find the Firebase Functions service account (usually `YOUR_PROJECT@appspot.gserviceaccount.com`)
3. Ensure it has the **Cloud Vision API User** role

Or grant via gcloud:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT@appspot.gserviceaccount.com" \
  --role="roles/ml.user"
```

## Step 4: Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions:uploadInvoiceFile,functions:extractInvoiceData
```

## Step 5: Test the System

### Test 1: Upload Invoice File

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const uploadInvoiceFile = httpsCallable(functions, "uploadInvoiceFile");

// First, upload file to Firebase Storage using existing uploadFile function
// Then create extraction job:
const result = await uploadInvoiceFile({
  orgId: "your-org-id",
  fileUrl: "https://storage.googleapis.com/your-bucket/path/to/invoice.pdf",
  fileName: "invoice.pdf",
  fileType: "pdf",
  fileSizeBytes: 1024000, // 1MB
});

console.log("Extraction Job ID:", result.data.jobId);
```

### Test 2: Extract Invoice Data

```typescript
const extractInvoiceData = httpsCallable(functions, "extractInvoiceData");

const result = await extractInvoiceData({
  jobId: "extraction-job-id-from-step-1",
});

console.log("Extracted Data:", result.data.job.extractedData);
console.log("Status:", result.data.job.status);
```

## Step 6: Monitor Logs

```bash
firebase functions:log --only extractInvoiceData
```

## Troubleshooting

### Error: "Google Cloud Vision OCR service is not available"

**Solution:**
1. Verify Vision API is enabled
2. Check service account permissions
3. Ensure project ID is set correctly (check `process.env.GCLOUD_PROJECT`)

### Error: "Failed to initialize Google Cloud Vision OCR service"

**Solution:**
1. Check that `@google-cloud/vision` is installed
2. Verify Firebase Admin SDK is initialized
3. Check network connectivity to Google Cloud APIs

### Error: "File URL is not a recognized GCS format"

**Solution:**
- Ensure files are uploaded to Firebase Storage
- Use the Firebase Storage URL format: `https://storage.googleapis.com/BUCKET/PATH`
- Or use GCS format: `gs://BUCKET/PATH`

## Next Steps

1. **Create Frontend UI** for uploading and validating invoices
2. **Implement Template Matching** to match extracted invoices to existing templates
3. **Add Template Generation** to create templates from extracted data
4. **Build Validation Interface** for users to review and correct extracted data

## API Reference

### `uploadInvoiceFile`

**Request:**
```typescript
{
  orgId: string;
  fileUrl: string;  // Firebase Storage URL
  fileName: string;
  fileType: "pdf" | "image/jpeg" | "image/png" | "image/jpg" | "image/webp";
  fileSizeBytes: number;
}
```

**Response:**
```typescript
{
  jobId: string;
}
```

### `extractInvoiceData`

**Request:**
```typescript
{
  jobId: string;
}
```

**Response:**
```typescript
{
  job: {
    id: string;
    status: "extracted" | "failed" | "processing";
    extractedData?: Record<string, unknown>;
    confidenceScores?: Record<string, number>;
    processingDurationMs?: number;
    errorMessage?: string;
    // ... other fields
  };
}
```

## Cost Considerations

Google Cloud Vision API pricing:
- **Document Text Detection**: $1.50 per 1,000 pages (first 1,000 pages/month free)
- **Image Content Analysis**: Varies by feature

Monitor usage in Google Cloud Console > Billing > Reports

## Security Notes

- All functions require authentication (member+ role)
- Files are scoped to organizations (`orgId`)
- Extraction jobs are isolated per organization
- Audit logging is available for all operations

