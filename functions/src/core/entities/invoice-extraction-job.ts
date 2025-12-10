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
    boundingBox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  })).optional(),
});

export type ExtractionJobData = z.infer<typeof extractionJobDataSchema>;

export const extractionJobSchema = baseEntitySchema.merge(extractionJobDataSchema);
export type ExtractionJob = z.infer<typeof extractionJobSchema>;

/**
 * Helper type for creating extraction jobs
 */
export type CreateExtractionJobInput = Omit<ExtractionJobData, "status" | "extractedData" | "confidenceScores" | "fieldMappings" | "correctedData" | "createdInvoiceId" | "createdTemplateId" | "createdTemplatePatternId" | "errorMessage" | "processingDurationMs" | "vendorName" | "documentType" | "ocrRawResults"> & {
  status?: ExtractionJobStatus;
};

