# External Invoice Upload & Extraction System

## Overview

A comprehensive system for uploading external invoices (PDFs/images), automatically extracting structured data using OCR/AI, generating reusable templates, and enabling future auto-population of similar invoices.

## Architecture Analysis

### Current System Patterns

**Backend Architecture:**
- **Functions Layer** (`functions/src/functions/`): Entry points with validation, auth, usage tracking
- **App Handlers** (`functions/src/app/`): Pure business logic, no Firebase-specific code
- **Services** (`functions/src/services/`): Orchestration, external APIs, complex business rules
- **Repositories** (`functions/src/repositories/`): Data access only, CRUD operations
- **Core Entities** (`functions/src/core/entities/`): Zod schemas, type definitions

**Frontend Architecture:**
- **Pages** (`app/src/pages/`): Route-level components
- **Components** (`app/src/components/`): Reusable UI elements
- **Hooks** (`app/src/hooks/`): React Query hooks for data fetching/mutations
- **Services** (`app/src/services/`): API clients
- **Core** (`app/src/core/`): Types, interfaces, ports

**Key Patterns:**
- Strong typing with Zod schemas
- Multi-tenancy via `orgId`
- Role-based access control (owner/admin/member/viewer)
- Usage tracking for billing/analytics
- Dynamic invoice data structure based on template bindings
- Template versioning system

### Existing Invoice System

**Invoice Structure:**
- Dynamic `data` field matching template bindings
- Template-based with dot-notation bindings (e.g., `seller.name`, `items[*].total`)
- Support for nested objects and arrays (tables)
- Status tracking: draft/sent/paid/cancelled

**Template System:**
- Visual designer with drag-and-drop
- Elements: text, image, table, box, line, input, currency
- Bindings connect elements to invoice data paths
- Versioning support
- Compliance metadata (region, required fields)

**File Upload:**
- Existing `uploadFile` function handles images
- Firebase Storage integration
- Base64 encoding support
- 10MB size limit (currently images only)

## System Design

### 1. Data Models

#### Invoice Extraction Job

```typescript
// functions/src/core/entities/invoice-extraction-job.ts
import z from "zod";
import { baseEntitySchema } from "./base";

export const extractionJobStatusSchema = z.enum([
  "pending",      // Uploaded, waiting for processing
  "processing",   // OCR/AI extraction in progress
  "extracted",    // Data extracted, awaiting validation
  "validated",    // User validated/corrected, ready to save
  "completed",   // Invoice created from extraction
  "failed",       // Processing failed
  "cancelled",    // User cancelled
]);

export const extractionJobDataSchema = z.object({
  orgId: z.string().min(1),
  
  // Source file information
  fileUrl: z.string().url(),           // Storage URL of uploaded file
  fileName: z.string().min(1),
  fileType: z.enum(["pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"]),
  fileSizeBytes: z.number().int().positive(),
  
  // Processing configuration
  ocrProvider: z.enum(["google_vision"]).default("google_vision"),  // Using Google Cloud Vision API
  aiModel: z.enum(["gemini"]).optional(),  // Using Google Gemini for structured extraction
  processingMode: z.enum(["cloud"]).default("cloud"),  // Cloud-only with Google Cloud Vision
  
  // Extraction results
  status: extractionJobStatusSchema,
  extractedData: z.record(z.string(), z.unknown()).optional(),  // Raw extracted data
  confidenceScores: z.record(z.string(), z.number()).optional(), // Field-level confidence
  
  // Template matching
  matchedTemplateId: z.string().optional(),  // Auto-matched template
  matchConfidence: z.number().min(0).max(1).optional(),
  
  // Validation & mapping
  fieldMappings: z.array(z.object({
    extractedField: z.string(),        // Key from extractedData
    templateBinding: z.string(),       // Binding path in template
    confidence: z.number().min(0).max(1),
    userVerified: z.boolean().default(false),
  })).optional(),
  
  // User corrections
  correctedData: z.record(z.string(), z.unknown()).optional(),
  
  // Result
  createdInvoiceId: z.string().optional(),
  createdTemplateId: z.string().optional(),  // If template was auto-generated
  
  // Metadata
  errorMessage: z.string().optional(),
  processingDurationMs: z.number().int().optional(),
  vendorName: z.string().optional(),  // Detected vendor name
  documentType: z.enum(["invoice", "receipt", "utility_bill", "unknown"]).optional(),
});

export type ExtractionJobData = z.infer<typeof extractionJobDataSchema>;
export const extractionJobSchema = baseEntitySchema.merge(extractionJobDataSchema);
export type ExtractionJob = z.infer<typeof extractionJobSchema>;
```

#### Invoice Template Pattern

```typescript
// functions/src/core/entities/invoice-template-pattern.ts
import z from "zod";
import { baseEntitySchema } from "./base";

export const templatePatternDataSchema = z.object({
  orgId: z.string().min(1),
  
  // Pattern identification
  name: z.string().min(1),  // e.g., "Acme Corp Invoice Pattern"
  vendorName: z.string().optional(),  // Vendor name for matching
  vendorKeywords: z.array(z.string()).default([]),  // Keywords for matching
  
  // Template reference
  templateId: z.string().min(1),  // Reference to the template
  
  // Field mappings (how to map extracted data to template bindings)
  fieldMappings: z.array(z.object({
    extractedField: z.string(),        // Key from extracted data (e.g., "invoice_number")
    templateBinding: z.string(),       // Template binding path (e.g., "invoiceNumber")
    extractionRules: z.object({
      regex: z.string().optional(),    // Regex pattern for extraction
      keywords: z.array(z.string()).optional(),  // Keywords to look for
      position: z.enum(["header", "body", "footer", "any"]).optional(),
    }).optional(),
  })),
  
  // Layout signature (for visual matching)
  layoutSignature: z.object({
    vendorLogoPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    invoiceNumberPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    totalAmountPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    tableRegion: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
  }).optional(),
  
  // Matching configuration
  matchThreshold: z.number().min(0).max(1).default(0.7),  // Minimum confidence to match
  
  // Usage statistics
  matchCount: z.number().int().default(0),
  lastMatchedAt: z.string().optional(),
  
  // Source
  sourceExtractionJobId: z.string().optional(),  // Job that created this pattern
});

export type TemplatePatternData = z.infer<typeof templatePatternDataSchema>;
export const templatePatternSchema = baseEntitySchema.merge(templatePatternDataSchema);
export type TemplatePattern = z.infer<typeof templatePatternSchema>;
```

### 2. System Architecture

#### Component Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  Upload UI → Validation UI → Template Selector → Review   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloud Functions (Entry Points)                  │
├─────────────────────────────────────────────────────────────┤
│  uploadInvoiceFile → extractInvoiceData → validateExtraction │
│  → createInvoiceFromExtraction → createTemplatePattern       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Application Handlers (Business Logic)           │
├─────────────────────────────────────────────────────────────┤
│  handleUploadInvoiceFile → handleExtractInvoiceData         │
│  → handleValidateExtraction → handleCreateInvoiceFromExt    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
├─────────────────────────────────────────────────────────────┤
│  OCRService → AIExtractionService → TemplateMatchingService │
│  → TemplateGenerationService                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Repositories Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ExtractionJobRepository → TemplatePatternRepository        │
│  → InvoiceRepository → TemplateRepository                    │
└─────────────────────────────────────────────────────────────┘
```

#### Service Implementations

**OCR Service** (`functions/src/services/invoice-extraction/ocr-service.ts`):
- Abstract interface for OCR providers
- Primary implementation: **Google Cloud Vision API** (Document Text Detection)
- Uses Google Enterprise API features for enhanced document analysis
- Returns structured text with bounding boxes, confidence scores, and layout information
- Supports both images and PDFs via Cloud Vision API

**AI Extraction Service** (`functions/src/services/invoice-extraction/ai-extraction-service.ts`):
- Uses **Google Gemini** (via existing AI service infrastructure) for structured extraction
- Leverages Cloud Vision API results + Gemini for intelligent field extraction
- Returns normalized invoice data structure matching template bindings
- Handles field mapping, validation, and data normalization

**Template Matching Service** (`functions/src/services/invoice-extraction/template-matching-service.ts`):
- Matches extracted invoices to existing template patterns
- Uses vendor name, keywords, layout signatures
- Returns match confidence and suggested template

**Template Generation Service** (`functions/src/services/invoice-extraction/template-generation-service.ts`):
- Generates invoice templates from extracted data
- Uses existing `InvoiceTemplateGenerationService` patterns
- Creates field mappings and layout signatures

### 3. Processing Flow

#### Single Invoice Upload Flow

```
1. User uploads file (PDF/image)
   ↓
2. File stored in Firebase Storage
   ↓
3. ExtractionJob created (status: "pending")
   ↓
4. OCR Service extracts text + layout
   ↓
5. AI Extraction Service structures data
   ↓
6. Template Matching Service finds best match
   ↓
7. ExtractionJob updated (status: "extracted", matchedTemplateId set)
   ↓
8. User reviews extracted data in validation UI
   ↓
9. User corrects/verifies field mappings
   ↓
10. ExtractionJob updated (status: "validated", correctedData set)
    ↓
11. User chooses action:
    a) Create invoice → Invoice created, ExtractionJob (status: "completed")
    b) Create template pattern → TemplatePattern created, ExtractionJob (status: "completed")
    c) Both → Both created
```

#### Bulk Upload Flow

```
1. User uploads multiple files (zip or multiple selection)
   ↓
2. Batch ExtractionJob created (parent job with child jobs)
   ↓
3. Process each file in parallel (with rate limiting)
   ↓
4. Show progress dashboard
   ↓
5. User reviews batch results
   ↓
6. User can:
   - Approve all
   - Approve selected
   - Bulk correct common fields
   - Create template patterns for groups
```

### 4. UX Flow

#### Upload Page (`app/src/pages/invoices/upload-invoice.tsx`)

**Step 1: Upload**
- Drag-and-drop or file picker
- Support: PDF, JPEG, PNG, WebP
- Show upload progress
- Preview uploaded file

**Step 2: Processing**
- Show processing status
- Real-time updates via Firestore listeners
- Estimated time remaining

**Step 3: Validation**
- Side-by-side view:
  - Left: Original document preview
  - Right: Extracted data form (editable)
- Field mapping visualization:
  - Highlight extracted fields on document
  - Show confidence scores
  - Allow manual corrections
- Template selector:
  - Show matched template
  - Allow template selection/creation
  - Preview how data maps to template

**Step 4: Review & Save**
- Final review of mapped data
- Options:
  - Create invoice
  - Create template pattern
  - Create both
  - Save as draft

#### Validation Interface Components

**Field Mapping Editor** (`app/src/components/invoice-extraction/field-mapping-editor.tsx`):
- Visual mapping between extracted fields and template bindings
- Drag-and-drop to remap fields
- Confidence indicators
- Validation errors

**Document Viewer** (`app/src/components/invoice-extraction/document-viewer.tsx`):
- PDF/image viewer with field highlights
- Click to select/correct fields
- Zoom/pan controls

**Extraction Results Panel** (`app/src/components/invoice-extraction/extraction-results-panel.tsx`):
- Form with extracted data
- Editable fields
- Validation feedback
- Template binding indicators

### 5. Security & Privacy

**Access Control:**
- Role-based: member+ can upload, admin+ can configure OCR providers
- Organization isolation: all data scoped to `orgId`
- Audit logging: track all extraction jobs and data access

**Privacy:**
- Support on-prem OCR processing (Tesseract)
- Cloud OCR: encrypt files in transit and at rest
- Data retention: configurable retention policies
- PII handling: mask sensitive data in logs

**Configuration:**
- Organization-level OCR provider selection
- Processing mode (cloud vs on-prem)
- Data retention settings
- Auto-delete after processing (optional)

### 6. Implementation Plan

#### Phase 1: Core Infrastructure (Week 1-2)

**Backend:**
1. Create `ExtractionJob` entity and repository
2. Create `TemplatePattern` entity and repository
3. Extend `uploadFile` function to support PDFs
4. Create OCR service interface and Google Vision implementation
5. Create extraction job processing handler

**Frontend:**
1. Create upload page with file picker
2. Create extraction job status component
3. Create basic validation UI

#### Phase 2: OCR & Extraction (Week 3-4)

**Backend:**
1. Implement AI extraction service (Gemini Vision)
2. Create field mapping logic
3. Implement template matching service
4. Add confidence scoring

**Frontend:**
1. Create document viewer component
2. Create field mapping editor
3. Create extraction results panel
4. Add real-time updates via Firestore listeners

#### Phase 3: Template Generation & Matching (Week 5-6)

**Backend:**
1. Implement template generation from extraction
2. Create template pattern creation logic
3. Enhance template matching with layout signatures
4. Add bulk processing support

**Frontend:**
1. Create template selector component
2. Add template preview
3. Create bulk upload UI
4. Add batch processing dashboard

#### Phase 4: Advanced Features (Week 7-8)

**Backend:**
1. Enhance Google Cloud Vision API usage (advanced features, batch processing)
2. Add vendor detection and auto-categorization using Gemini
3. Implement learning from user corrections
4. Add image content analysis for better field detection
5. Optimize Cloud Vision API usage (caching, batch requests)

**Frontend:**
1. Add advanced field mapping options
2. Create pattern management UI
3. Add extraction history and statistics
4. Implement auto-save and draft recovery

### 7. File Structure

```
functions/src/
├── functions/
│   ├── upload-invoice-file.ts
│   ├── extract-invoice-data.ts
│   ├── validate-extraction.ts
│   ├── create-invoice-from-extraction.ts
│   └── create-template-pattern.ts
├── app/
│   ├── handle-upload-invoice-file.ts
│   ├── handle-extract-invoice-data.ts
│   ├── handle-validate-extraction.ts
│   ├── handle-create-invoice-from-extraction.ts
│   └── handle-create-template-pattern.ts
├── services/
│   └── invoice-extraction/
│       ├── ocr-service.ts                    # Abstract OCR interface
│       ├── google-vision-ocr-service.ts      # Google Cloud Vision API implementation
│       ├── ai-extraction-service.ts           # Gemini-based structured extraction
│       ├── template-matching-service.ts      # Template pattern matching
│       └── template-generation-service.ts     # Template generation from extraction
├── repositories/
│   ├── extraction-job-repository.ts
│   └── template-pattern-repository.ts
└── core/
    └── entities/
        ├── invoice-extraction-job.ts
        └── invoice-template-pattern.ts

app/src/
├── pages/
│   └── invoices/
│       ├── upload-invoice.tsx
│       └── extraction-jobs.tsx
├── components/
│   └── invoice-extraction/
│       ├── document-viewer.tsx
│       ├── field-mapping-editor.tsx
│       ├── extraction-results-panel.tsx
│       ├── template-selector.tsx
│       └── extraction-job-status.tsx
├── hooks/
│   └── repository-hooks/
│       ├── use-extraction-jobs.ts
│       └── use-template-patterns.ts
└── services/
    └── invoice-extraction-service.ts
```

### 8. Usage Tracking

Add to `functions/src/usage/usage-features.ts`:

```typescript
export const USAGE_FEATURES = {
  // ... existing
  INVOICE_EXTRACTION_UPLOAD: "invoice.extraction.upload",
  INVOICE_EXTRACTION_PROCESS: "invoice.extraction.process",
  INVOICE_EXTRACTION_CREATE_INVOICE: "invoice.extraction.create_invoice",
  INVOICE_EXTRACTION_CREATE_PATTERN: "invoice.extraction.create_pattern",
  INVOICE_EXTRACTION_BULK_PROCESS: "invoice.extraction.bulk_process",
} as const;
```

### 9. Error Handling

**OCR Failures:**
- Retry with exponential backoff
- Fallback to alternative provider
- User notification with manual entry option

**Extraction Failures:**
- Partial extraction with low-confidence fields marked
- User can manually fill missing fields
- Save as draft for later completion

**Template Matching Failures:**
- Allow user to select template manually
- Option to create new template from extraction

### 10. Performance Considerations

**Processing:**
- Async processing with Cloud Functions
- Queue system for bulk uploads
- Rate limiting per organization
- Parallel processing for multiple files

**Storage:**
- Compress uploaded files
- Auto-delete after processing (configurable)
- Archive old extraction jobs

**Caching:**
- Cache template patterns for faster matching
- Cache OCR results for duplicate files

### 11. Testing Strategy

**Unit Tests:**
- OCR service implementations
- Field mapping logic
- Template matching algorithms
- Data normalization

**Integration Tests:**
- End-to-end extraction flow
- Template generation from extraction
- Bulk processing

**E2E Tests:**
- Upload → Extract → Validate → Create invoice flow
- Template pattern creation and matching

### 12. Future Enhancements

1. **Machine Learning:**
   - Learn from user corrections to improve extraction
   - Auto-suggest field mappings based on history
   - Vendor-specific extraction models

2. **Advanced Matching:**
   - Visual similarity matching (layout comparison)
   - Multi-vendor pattern detection
   - Automatic pattern updates

3. **Integration:**
   - Email import (extract invoices from emails)
   - API for third-party integrations
   - Webhook notifications for completed extractions

4. **Analytics:**
   - Extraction accuracy metrics
   - Processing time statistics
   - Template pattern usage analytics

## Conclusion

This system provides a comprehensive solution for external invoice upload and extraction, following existing architectural patterns, maintaining security and privacy, and enabling long-term automation with minimal user setup.

