import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Status of an invoice extraction job
 */
export const extractionJobStatusSchema = z.enum([
  "pending",      // Uploaded, waiting for processing
  "processing",   // OCR/AI extraction in progress
  "extracted",    // Data extracted, awaiting validation
  "validated",    // User validated/corrected, ready to save
  "completed",   // Invoice created from extraction
  "failed",       // Processing failed
  "cancelled",    // User cancelled
]);

export type ExtractionJobStatus = z.infer<typeof extractionJobStatusSchema>;

/**
 * Field mapping between extracted data and template bindings
 */
export const fieldMappingSchema = z.object({
  extractedField: z.string(),        // Key from extractedData
  templateBinding: z.string(),       // Binding path in template (e.g., "invoiceNumber")
  confidence: z.number().min(0).max(1),
  userVerified: z.boolean().default(false),
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const polygonPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const normalizedBoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const documentPageSchema = z.object({
  pageIndex: z.number().int().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  imageUrl: z.string().url(),
  mimeType: z.string().optional(),
  source: z.enum(["original", "rendered_pdf"]),
});

const ocrWordSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  pageIndex: z.number().int().min(0),
  boundingBox: boundingBoxSchema,
  normalizedBoundingBox: normalizedBoundingBoxSchema,
  polygon: z.array(polygonPointSchema).default([]),
});

const visionLayoutRegionSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().min(0),
  kind: z.enum(["header", "parties", "meta", "table", "totals", "footer", "misc"]),
  boundingBox: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
});

const visionLayoutElementSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().min(0),
  kind: z.enum(["label", "value", "text", "logo", "image", "table", "table_header", "table_cell", "line", "other"]),
  text: z.string().optional(),
  boundingBox: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
  styleClusterId: z.string().optional(),
  bindingHint: z.string().optional(),
  currencyLike: z.boolean().optional(),
});

const visionLayoutTableSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().min(0),
  boundingBox: boundingBoxSchema,
  columnHeaders: z.array(z.string()).default([]),
  columns: z.array(
    z.object({
      id: z.string(),
      header: z.string().optional(),
      boundingBox: boundingBoxSchema.optional(),
      type: z.enum(["text", "number", "date", "currency", "unknown"]).optional(),
      confidence: z.number().min(0).max(1),
    })
  ).optional(),
  headerBoundingBox: boundingBoxSchema.optional(),
  rowCount: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

const visionStyleClusterSchema = z.object({
  id: z.string(),
  fontFamilyHint: z.string().optional(),
  fontWeightHint: z.string().optional(),
  fontSizePx: z.number().positive().optional(),
  color: z.string().optional(),
  sampleTexts: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const visionLayoutSchema = z.object({
  regions: z.array(visionLayoutRegionSchema).default([]),
  elements: z.array(visionLayoutElementSchema).default([]),
  tables: z.array(visionLayoutTableSchema).default([]),
  styleClusters: z.array(visionStyleClusterSchema).default([]),
});

const fusionMapEntrySchema = z.object({
  binding: z.string(),
  valueText: z.string().optional(),
  ocrWordIds: z.array(z.string()).default([]),
  layoutNodeIds: z.array(z.string()).default([]),
  boundingBox: boundingBoxSchema.optional(),
  confidence: z.number().min(0).max(1),
  fieldType: z.enum(["text", "currency", "date", "number", "table", "unknown"]).default("unknown"),
});

const fontMatchSchema = z.object({
  clusterId: z.string(),
  provider: z.enum(["external_api", "fallback"]),
  matchedFont: z.string(),
  fallbackFont: z.string(),
  confidence: z.number().min(0).max(1),
  raw: z.record(z.string(), z.unknown()).optional(),
});

const templateQualitySchema = z.object({
  overall: z.number().min(0).max(1),
  layout: z.number().min(0).max(1),
  text: z.number().min(0).max(1),
  table: z.number().min(0).max(1),
  font: z.number().min(0).max(1),
});

const croppedAssetSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().min(0),
  kind: z.enum(["logo", "image"]),
  imageUrl: z.string().url(),
  boundingBox: boundingBoxSchema,
  confidence: z.number().min(0).max(1),
});

/**
 * Invoice extraction job data schema
 * Tracks the entire lifecycle of extracting invoice data from uploaded documents
 */
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
  extractedData: z.record(z.string(), z.unknown()).optional(),  // Raw extracted data from OCR/AI
  confidenceScores: z.record(z.string(), z.number()).optional(), // Field-level confidence scores
  
  // Template matching
  matchedTemplateId: z.string().optional(),  // Auto-matched template ID
  matchConfidence: z.number().min(0).max(1).optional(),
  
  // Validation & mapping
  fieldMappings: z.array(fieldMappingSchema).optional(),
  
  // User corrections
  correctedData: z.record(z.string(), z.unknown()).optional(),
  
  // Result
  createdInvoiceId: z.string().optional(),
  createdTemplateId: z.string().optional(),  // If template was auto-generated
  createdTemplatePatternId: z.string().optional(),  // If pattern was created
  /** Template generated by vision (extract or generateTemplate); reused without a second call */
  generatedTemplate: z.record(z.string(), z.unknown()).optional(),
  
  // Metadata
  errorMessage: z.string().optional(),
  processingDurationMs: z.number().int().optional(),
  vendorName: z.string().optional(),  // Detected vendor name
  documentType: z.enum(["invoice", "receipt", "utility_bill", "unknown"]).optional(),
  
  // OCR raw results (for debugging/reprocessing and template generation)
  ocrRawResults: z.record(z.string(), z.unknown()).optional(),
  
  // OCR text blocks with layout information (for template generation from layout)
  ocrTextBlocks: z.array(z.object({
    text: z.string(),
    confidence: z.number(),
    boundingBox: boundingBoxSchema,
  })).optional(),

  // Page-aware normalized data for the hybrid pipeline
  documentPages: z.array(documentPageSchema).optional(),
  ocrWords: z.array(ocrWordSchema).optional(),
  visionLayout: visionLayoutSchema.optional(),
  fusionMap: z.array(fusionMapEntrySchema).optional(),
  fontMatches: z.array(fontMatchSchema).optional(),
  croppedAssets: z.array(croppedAssetSchema).optional(),
  quality: templateQualitySchema.optional(),
  needsReview: z.boolean().optional(),
  reviewReasons: z.array(z.string()).optional(),
});

export type ExtractionJobData = z.infer<typeof extractionJobDataSchema>;

export const extractionJobSchema = baseEntitySchema.merge(extractionJobDataSchema);
export type ExtractionJob = z.infer<typeof extractionJobSchema>;

/**
 * Helper type for creating extraction jobs
 */
export type CreateExtractionJobInput = Omit<
  ExtractionJobData,
  | "status"
  | "extractedData"
  | "confidenceScores"
  | "fieldMappings"
  | "correctedData"
  | "createdInvoiceId"
  | "createdTemplateId"
  | "createdTemplatePatternId"
  | "errorMessage"
  | "processingDurationMs"
  | "vendorName"
  | "documentType"
  | "ocrRawResults"
  | "ocrTextBlocks"
  | "documentPages"
  | "ocrWords"
  | "visionLayout"
  | "fusionMap"
  | "fontMatches"
  | "croppedAssets"
  | "quality"
  | "needsReview"
  | "reviewReasons"
  | "generatedTemplate"
> & {
  status?: ExtractionJobStatus;
};
