import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Field mapping configuration for template patterns
 */
export const patternFieldMappingSchema = z.object({
  extractedField: z.string(),        // Key from extracted data (e.g., "invoice_number")
  templateBinding: z.string(),       // Template binding path (e.g., "invoiceNumber")
  extractionRules: z.object({
    regex: z.string().optional(),    // Regex pattern for extraction
    keywords: z.array(z.string()).optional(),  // Keywords to look for
    position: z.enum(["header", "body", "footer", "any"]).optional(),
  }).optional(),
});

export type PatternFieldMapping = z.infer<typeof patternFieldMappingSchema>;

/**
 * Layout signature for visual template matching
 */
export const layoutSignatureSchema = z.object({
  vendorLogoPosition: z.object({ 
    x: z.number(), 
    y: z.number() 
  }).optional(),
  invoiceNumberPosition: z.object({ 
    x: z.number(), 
    y: z.number() 
  }).optional(),
  totalAmountPosition: z.object({ 
    x: z.number(), 
    y: z.number() 
  }).optional(),
  tableRegion: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

export type LayoutSignature = z.infer<typeof layoutSignatureSchema>;

/**
 * Invoice template pattern data schema
 * Stores reusable patterns for matching similar invoices to templates
 */
export const templatePatternDataSchema = z.object({
  orgId: z.string().min(1),
  
  // Pattern identification
  name: z.string().min(1),  // e.g., "Acme Corp Invoice Pattern"
  vendorName: z.string().optional(),  // Vendor name for matching
  vendorKeywords: z.array(z.string()).default([]),  // Keywords for matching
  
  // Template reference
  templateId: z.string().min(1),  // Reference to the template
  
  // Field mappings (how to map extracted data to template bindings)
  fieldMappings: z.array(patternFieldMappingSchema),
  
  // Layout signature (for visual matching)
  layoutSignature: layoutSignatureSchema.optional(),
  
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

/**
 * Helper type for creating template patterns
 */
export type CreateTemplatePatternInput = Omit<TemplatePatternData, "matchCount" | "lastMatchedAt"> & {
  matchCount?: number;
};

