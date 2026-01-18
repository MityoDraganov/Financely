import z from "zod";

/**
 * Export/Import Entity Types
 */
export type ExportEntityType = "products" | "invoices" | "contacts" | "leads" | "proposals" | "templates";
export type ExportFormat = "csv" | "xls" | "xlsx";
export type ImportMode = "create-only" | "upsert";
export type ConflictPolicy = "skip" | "overwrite" | "merge";

/**
 * Export Job Status
 */
export const exportJobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export type ExportJobStatus = z.infer<typeof exportJobStatusSchema>;

/**
 * Import Job Status
 */
export const importJobStatusSchema = z.enum([
  "queued",
  "parsing",
  "validating",
  "importing",
  "completed",
  "failed",
]);

export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;

/**
 * Export Job Statistics
 */
export const exportJobStatsSchema = z.object({
  totalRecords: z.number().int().min(0).default(0),
  exportedRecords: z.number().int().min(0).default(0),
});

export type ExportJobStats = z.infer<typeof exportJobStatsSchema>;

/**
 * Import Job Statistics
 */
export const importJobStatsSchema = z.object({
  totalRows: z.number().int().min(0).default(0),
  validRows: z.number().int().min(0).default(0),
  importedRows: z.number().int().min(0).default(0),
  skippedRows: z.number().int().min(0).default(0),
  errorRows: z.number().int().min(0).default(0),
});

export type ImportJobStats = z.infer<typeof importJobStatsSchema>;

/**
 * Export Job Schema
 */
export const exportJobSchema = z.object({
  id: z.string(),
  orgId: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  status: exportJobStatusSchema,
  entityTypes: z.array(z.enum(["products", "invoices", "contacts", "leads", "proposals", "templates"])),
  format: z.enum(["csv", "xls", "xlsx"]),
  fileUrl: z.string().url().optional(),
  fileSizeBytes: z.number().int().min(0).optional(),
  stats: exportJobStatsSchema,
  error: z.string().optional(),
  notifyEmail: z.boolean().default(true), // Opt-in email notification (default: true)
  emailRecipient: z.string().email().optional(), // Email address to notify (defaults to user's email)
  options: z.object({
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    status: z.array(z.string()).optional(),
    includeArchived: z.boolean().optional(),
  }).optional(),
});

export type ExportJob = z.infer<typeof exportJobSchema>;

export const exportJobDataSchema = exportJobSchema.omit({ id: true });
export type ExportJobData = z.infer<typeof exportJobDataSchema>;

/**
 * Import Job Schema
 */
export const importJobSchema = z.object({
  id: z.string(),
  orgId: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  status: importJobStatusSchema,
  entityType: z.enum(["products", "invoices", "contacts", "leads", "proposals", "templates"]),
  fileUrl: z.string().url(),
  fileName: z.string(),
  mode: z.enum(["create-only", "upsert"]),
  columnMapping: z.record(z.string(), z.string()),
  stats: importJobStatsSchema,
  errorReportUrl: z.string().url().optional(),
  error: z.string().optional(),
  options: z.object({
    skipInvalidRows: z.boolean().optional(),
    conflictPolicy: z.enum(["skip", "overwrite", "merge"]).optional(),
  }).optional(),
});

export type ImportJob = z.infer<typeof importJobSchema>;

export const importJobDataSchema = importJobSchema.omit({ id: true });
export type ImportJobData = z.infer<typeof importJobDataSchema>;

/**
 * Export Request Input
 */
export const exportDataInputSchema = z.object({
  orgId: z.string().min(1),
  entityTypes: z.array(z.enum(["products", "invoices", "contacts", "leads", "proposals", "templates"])).min(1),
  format: z.enum(["csv", "xls", "xlsx"]),
  notifyEmail: z.boolean().default(true), // Opt-in email notification (default: true)
  emailRecipient: z.string().email().optional(), // Email address to notify (defaults to user's email)
  options: z.object({
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    status: z.array(z.string()).optional(),
    includeArchived: z.boolean().optional(),
  }).optional(),
});

export type ExportDataInput = z.infer<typeof exportDataInputSchema>;

/**
 * Import Request Input
 */
export const importDataInputSchema = z.object({
  orgId: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  entityType: z.enum(["products", "invoices", "contacts", "leads", "proposals", "templates"]),
  mode: z.enum(["create-only", "upsert"]),
  columnMapping: z.record(z.string(), z.string()).optional(),
  options: z.object({
    skipInvalidRows: z.boolean().optional(),
    conflictPolicy: z.enum(["skip", "overwrite", "merge"]).optional(),
  }).optional(),
});

export type ImportDataInput = z.infer<typeof importDataInputSchema>;

/**
 * Error Code Types
 */
export type ImportErrorCode =
  | "MISSING_REQUIRED"
  | "INVALID_TYPE"
  | "INVALID_DATE"
  | "INVALID_EMAIL"
  | "INVALID_NUMBER"
  | "UNKNOWN_REFERENCE"
  | "DUPLICATE_KEY"
  | "VALUE_OUT_OF_RANGE"
  | "ENUM_NOT_ALLOWED"
  | "FILE_PARSE_ERROR"
  | "MISSING_COLUMN"
  | "INVALID_FORMAT";

/**
 * Import Error Schema
 */
export const importErrorSchema = z.object({
  rowIndex: z.number().int().min(0),
  errorCode: z.string(),
  errorMessage: z.string(),
  field: z.string().optional(),
  value: z.unknown().optional(),
});

export type ImportError = z.infer<typeof importErrorSchema>;

/**
 * Error Report Schema
 */
export const errorReportSchema = z.object({
  jobId: z.string(),
  orgId: z.string(),
  entityType: z.string(),
  errors: z.array(importErrorSchema),
  generatedAt: z.string(),
});

export type ErrorReport = z.infer<typeof errorReportSchema>;

/**
 * Canonical Export Schema Base
 * All exported entities include these fields
 */
export const canonicalExportBaseSchema = z.object({
  schema_version: z.string().default("1.0"),
  external_id: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CanonicalExportBase = z.infer<typeof canonicalExportBaseSchema>;

/**
 * Product Export Schema (canonical, flattened)
 */
export const productExportSchema = canonicalExportBaseSchema.extend({
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  currency: z.string(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  stockQuantity: z.number().optional(),
  trackInventory: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
  images: z.string().optional(), // JSON stringified array
  category: z.string().optional(),
  tags: z.string().optional(), // JSON stringified array
  weight: z.number().optional(),
  dimensions_length: z.number().optional(),
  dimensions_width: z.number().optional(),
  dimensions_height: z.number().optional(),
  dimensions_unit: z.string().optional(),
  status: z.string().optional(),
  taxRate: z.number().optional(),
  cost: z.number().optional(),
});

export type ProductExport = z.infer<typeof productExportSchema>;

/**
 * Contact Export Schema (canonical, flattened)
 */
export const contactExportSchema = canonicalExportBaseSchema.extend({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(), // First phone or comma-separated
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_zipCode: z.string().optional(),
  address_country: z.string().optional(),
  tags: z.string().optional(), // JSON stringified array
  notes: z.string().optional(),
  status: z.string().optional(),
  preferences_preferredContactMethod: z.string().optional(),
  preferences_marketingOptIn: z.boolean().optional(),
  preferences_newsletterOptIn: z.boolean().optional(),
  socialMedia_linkedin: z.string().optional(),
  socialMedia_twitter: z.string().optional(),
  socialMedia_facebook: z.string().optional(),
  socialMedia_instagram: z.string().optional(),
});

export type ContactExport = z.infer<typeof contactExportSchema>;

/**
 * Lead Export Schema (canonical, flattened)
 */
export const leadExportSchema = canonicalExportBaseSchema.extend({
  contactId: z.string().optional(),
  widgetType: z.string(),
  source: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  formData: z.string().optional(), // JSON stringified
  message: z.string().optional(),
  status: z.string().optional(),
  tags: z.string().optional(), // JSON stringified array
  notes: z.string().optional(),
});

export type LeadExport = z.infer<typeof leadExportSchema>;

/**
 * Proposal Export Schema (canonical, flattened)
 * Note: Items are exported as separate sheet in XLSX, or JSON string in CSV
 */
export const proposalExportSchema = canonicalExportBaseSchema.extend({
  leadId: z.string().optional(),
  invoiceId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  items: z.string().optional(), // JSON stringified array for CSV, separate sheet for XLSX
  subtotal: z.number(),
  taxTotal: z.number(),
  total: z.number(),
  currency: z.string(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  approval_tokenHash: z.string().optional(),
  approval_expiresAt: z.string().optional(),
  approval_sentAt: z.string().optional(),
  approval_approvedAt: z.string().optional(),
  approval_rejectedAt: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  aiSuggestionId: z.string().optional(),
  isIncomplete: z.boolean().optional(),
  incompleteItems: z.string().optional(), // JSON stringified array
});

export type ProposalExport = z.infer<typeof proposalExportSchema>;

/**
 * Proposal Item Export Schema (for separate sheet)
 */
export const proposalItemExportSchema = z.object({
  proposal_external_id: z.string(), // Reference to parent proposal
  description: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  taxPct: z.number().optional(),
});

export type ProposalItemExport = z.infer<typeof proposalItemExportSchema>;

/**
 * Invoice Export Schema (canonical, flattened)
 * Note: Invoice data is dynamic based on template, so we export common fields + data as JSON
 */
export const invoiceExportSchema = canonicalExportBaseSchema.extend({
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  pdfUrl: z.string().optional(),
  data: z.string().optional(), // JSON stringified dynamic data
});

export type InvoiceExport = z.infer<typeof invoiceExportSchema>;

/**
 * Template Export Schema (canonical, flattened)
 * Note: Template elements are complex, exported as JSON string in CSV, separate consideration for XLSX
 */
export const templateExportSchema = canonicalExportBaseSchema.extend({
  name: z.string(),
  description: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  elements: z.string().optional(), // JSON stringified array
  brand: z.string().optional(), // JSON stringified
  compliance: z.string().optional(), // JSON stringified
  productTableConfig: z.string().optional(), // JSON stringified
});

export type TemplateExport = z.infer<typeof templateExportSchema>;
