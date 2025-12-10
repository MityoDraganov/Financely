# Template Generation Optimization Proposal

## Current Flow (Inefficient)

```
1. OCR → Extracts text + bounding boxes (layout info)
2. AI Extraction → Extracts structured data from text only
3. AI Template Generation → Generates template from scratch (ignores layout)
```

**Problems:**
- ❌ Wastes OCR layout information (we have exact positions but don't use them)
- ❌ AI has to "guess" layout instead of using real positions
- ❌ Slower (more AI processing)
- ❌ Less accurate (generated layout may not match original)
- ❌ More expensive (more AI tokens)

## Optimized Flow (Best Practice)

```
1. OCR → Extracts text + bounding boxes (layout info)
2. Store OCR textBlocks in ExtractionJob
3. AI Extraction → Extracts structured data + maps fields to OCR blocks
4. OCR-to-Template Conversion → Directly convert OCR blocks to template elements
5. AI Refinement (optional) → Only refine/validate, not generate from scratch
```

**Benefits:**
- ✅ Preserves original invoice layout (exact positions)
- ✅ Faster (minimal AI processing)
- ✅ More accurate (uses real positions)
- ✅ More efficient (reuses existing data)
- ✅ Better UX (template matches original invoice)

## Implementation Plan

### Phase 1: Store OCR Layout Data

**File: `functions/src/core/entities/invoice-extraction-job.ts`**

Add OCR textBlocks to ExtractionJob:
```typescript
ocrTextBlocks: z.array(z.object({
  text: z.string(),
  confidence: z.number(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
})).optional(),
```

**File: `functions/src/app/handle-extract-invoice-data.ts`**

Store textBlocks when saving OCR results:
```typescript
ocrRawResults: {
  fullText: ocrResult.fullText,
  textBlocks: ocrResult.textBlocks, // Store layout info
  textBlockCount: ocrResult.textBlocks.length,
  overallConfidence: ocrResult.confidence,
},
```

### Phase 2: Map Fields to OCR Blocks

**New File: `functions/src/services/invoice-extraction/ocr-field-mapping-service.ts`**

Service that maps extracted fields to OCR text blocks:
- Uses AI to identify which OCR blocks contain which fields
- Creates field-to-block mappings
- Handles nested fields and arrays

### Phase 3: OCR-to-Template Conversion

**New File: `functions/src/services/invoice-extraction/ocr-to-template-service.ts`**

Service that converts OCR blocks directly to template elements:
- Converts OCR bounding boxes to template element positions
- Maps field bindings to OCR blocks
- Creates table elements from grouped OCR blocks
- Handles text, currency, and input elements

### Phase 4: Refactor Template Generation

**File: `functions/src/services/invoice-extraction/template-from-extraction-service.ts`**

Refactor `generateTemplateFromExtraction` to:
1. Check if OCR textBlocks are available
2. If yes: Use OCR-to-template conversion (fast path)
3. If no: Fall back to AI generation (slow path)
4. Use AI only for refinement/validation, not generation

## Code Structure

```
functions/src/services/invoice-extraction/
├── ocr-service.ts (existing)
├── google-vision-ocr-service.ts (existing)
├── template-from-extraction-service.ts (refactor)
├── ocr-field-mapping-service.ts (new)
└── ocr-to-template-service.ts (new)
```

## Example: OCR-to-Template Conversion

```typescript
// OCR Block
{
  text: "Invoice #12345",
  boundingBox: { x: 500, y: 100, width: 150, height: 20 },
  confidence: 0.95
}

// Mapped to Template Element
{
  id: "invoice-number",
  type: "text",
  x: 500,  // Direct from OCR
  y: 100,  // Direct from OCR
  width: 150,  // Direct from OCR
  height: 20,  // Direct from OCR
  binding: "invoiceNumber",  // From field mapping
  text: "Invoice #",
  typography: { ... }
}
```

## Benefits Summary

1. **Accuracy**: Template matches original invoice layout exactly
2. **Speed**: ~70% faster (minimal AI processing)
3. **Cost**: ~80% cheaper (fewer AI tokens)
4. **UX**: Users see template that looks like their original invoice
5. **Reliability**: Less AI hallucination, more deterministic

## Migration Strategy

1. Add OCR textBlocks storage (backward compatible)
2. Implement OCR-to-template service (new path)
3. Keep AI generation as fallback
4. Gradually migrate to OCR-based generation
5. Remove AI generation once OCR path is stable


