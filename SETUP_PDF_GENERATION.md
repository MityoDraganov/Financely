# PDF Generation Setup Guide

## Prerequisites

The PDF generation functionality requires Puppeteer to be installed in the Firebase Functions project.

## Installation Steps

### 1. Install Puppeteer

Navigate to the functions directory and install puppeteer:

```bash
cd functions
npm install puppeteer
```

### 2. For Production Deployment

If deploying to Firebase Functions, you may need to use `puppeteer-core` with a bundled Chromium binary for better performance:

```bash
cd functions
npm uninstall puppeteer
npm install puppeteer-core @sparticuz/chromium
```

Then update the import in `functions/src/app/handle-render-invoice-pdf.ts`:

```typescript
// Instead of:
const puppeteer: any = await import("puppeteer");

// Use:
const puppeteer: any = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

### 3. Firebase Storage Configuration

Make sure your Firebase project has Storage enabled:

1. Go to Firebase Console
2. Navigate to Storage
3. Enable Storage if not already enabled
4. Set up security rules as needed

### 4. Update Firebase Functions Configuration

Increase memory and timeout in `firebase.json`:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs22",
    "memory": "1GB",
    "timeoutSeconds": 300
  }
}
```

## Usage

### From Frontend

```typescript
import { functionsService } from "@/services";

const renderPdf = async (invoiceId: string) => {
  try {
    const result = await functionsService.renderInvoicePdf({
      invoiceId
    });
    
    console.log("PDF URL:", result.url);
    // Open in new tab or download
    window.open(result.url, "_blank");
  } catch (error) {
    console.error("Failed to generate PDF:", error);
  }
};
```

### Using React Hook

```typescript
import { useRenderInvoicePdf } from "@/hooks";

function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const renderPdf = useRenderInvoicePdf();

  const handleGeneratePdf = () => {
    renderPdf.mutate(
      { invoiceId },
      {
        onSuccess: (result) => {
          window.open(result.url, "_blank");
        },
        onError: (error) => {
          toast.error(`Failed to generate PDF: ${error.message}`);
        },
      }
    );
  };

  return (
    <button
      onClick={handleGeneratePdf}
      disabled={renderPdf.isPending}
    >
      {renderPdf.isPending ? "Generating..." : "Download PDF"}
    </button>
  );
}
```

## How It Works

1. **Fetch Data**: Retrieves invoice and template from Firestore
2. **Generate HTML**: Creates HTML representation of the invoice using the template
3. **Convert to PDF**: Uses Puppeteer to render HTML as PDF
4. **Upload**: Saves PDF to Firebase Storage at `invoices/{orgId}/{invoiceId}.pdf`
5. **Return URL**: Returns public URL to access the PDF

## File Storage Structure

```
Firebase Storage:
└── invoices/
    └── {orgId}/
        └── {invoiceId}.pdf
```

## Security Considerations

1. **Authentication**: Add auth checks in the function (currently commented out)
2. **Storage Rules**: Configure Firebase Storage rules to control access
3. **Rate Limiting**: Consider adding rate limiting for PDF generation

Example Storage Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /invoices/{orgId}/{invoiceId}.pdf {
      // Allow public read (PDFs are marked public)
      allow read: if true;
      // Only functions can write
      allow write: if false;
    }
  }
}
```

## Troubleshooting

### Error: "Puppeteer is not installed"
Run: `cd functions && npm install puppeteer`

### Error: "Failed to launch browser"
For production, switch to `puppeteer-core` with `@sparticuz/chromium` (see step 2 above)

### Error: "Permission denied" on Storage
- Ensure Firebase Storage is enabled
- Check storage bucket permissions
- Verify service account has storage admin role

### PDF Generation Timeout
- Increase timeout in function configuration
- Optimize template complexity
- Consider caching generated PDFs

## Performance Tips

1. **Cache PDFs**: Store generated PDFs and only regenerate when invoice changes
2. **Optimize Templates**: Simplify complex templates to reduce render time
3. **Use CDN**: Consider using Firebase CDN for faster PDF delivery
4. **Background Processing**: For batch operations, use Cloud Tasks or Pub/Sub

## Cost Considerations

- Puppeteer requires more memory (1GB recommended)
- PDF generation takes longer (increased function execution time)
- Storage costs for PDF files
- Consider implementing PDF expiry/cleanup for old invoices

