import z from "zod";

/**
 * Invoice Compliance System
 * 
 * Defines legal requirements for invoices by region (USA, EU, etc.)
 * Ensures templates and invoice data meet mandatory legal standards
 * while allowing full creative freedom for layout and styling.
 */

// ============================================================================
// Region Types
// ============================================================================

export const invoiceRegionSchema = z.enum(["US", "EU", "CA", "AU", "UK"]);
export type InvoiceRegion = z.infer<typeof invoiceRegionSchema>;

// ============================================================================
// Field Definitions
// ============================================================================

/**
 * Invoice line item schema (common across regions)
 */
export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
  // Optional fields that may be required in specific regions
  vatRate: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0).optional(),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

/**
 * Address schema (common across regions)
 */
export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  // Full address as string (alternative format)
  full: z.string().optional(),
});

export type Address = z.infer<typeof addressSchema>;

/**
 * Business entity schema (seller/supplier)
 */
export const businessEntitySchema = z.object({
  name: z.string().min(1, "Business name is required"),
  address: addressSchema.optional(),
  // Tax identifiers
  taxId: z.string().optional(), // EIN for US, VAT for EU
  vatId: z.string().optional(), // EU VAT ID
  ein: z.string().optional(), // US EIN
  // Contact info
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
});

export type BusinessEntity = z.infer<typeof businessEntitySchema>;

/**
 * Customer entity schema
 */
export const customerEntitySchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: addressSchema.optional(),
  // Tax identifiers
  taxId: z.string().optional(),
  vatId: z.string().optional(),
  // Contact info
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export type CustomerEntity = z.infer<typeof customerEntitySchema>;

// ============================================================================
// USA Compliance Schema
// ============================================================================

export const invoiceSchemaUS = z.object({
  // Required fields
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"), // ISO date string
  seller: businessEntitySchema,
  customer: customerEntitySchema,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  
  // Optional but recommended
  dueDate: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  currency: z.string().default("USD"),
  
  // Reverse charge (rare in US, but possible)
  reverseCharge: z.boolean().default(false),
});

export type InvoiceDataUS = z.infer<typeof invoiceSchemaUS>;

// ============================================================================
// EU Compliance Schema
// ============================================================================

export const invoiceSchemaEU = z.object({
  // Required fields
  invoiceNumber: z.string().min(1, "Invoice number is required (legally mandatory)"),
  invoiceDate: z.string().min(1, "Invoice date is required (legally mandatory)"),
  supplier: businessEntitySchema.extend({
    vatId: z.string().min(1, "Supplier VAT ID is required for EU invoices"),
  }),
  customer: customerEntitySchema,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  
  // Financial totals (all required)
  netAmount: z.number().min(0, "Net amount is required"),
  vatTotal: z.number().min(0, "Total VAT amount is required"),
  grossTotal: z.number().min(0, "Gross total is required"),
  
  // Dates
  supplyDate: z.string().optional(), // Required if different from invoice date
  dueDate: z.string().optional(),
  
  // Currency (required, must be specified)
  currency: z.string().min(1, "Currency is required (ISO code)"),
  
  // Reverse charge (if applicable)
  reverseCharge: z.boolean().default(false),
  reverseChargeNote: z.string().optional(),
  
  // Optional but recommended
  notes: z.string().optional(),
  directiveCompliance: z.string().optional(), // e.g., "Complies with EU Directive 2006/112/EC"
});

export type InvoiceDataEU = z.infer<typeof invoiceSchemaEU>;

// ============================================================================
// Compliance Field Metadata
// ============================================================================

/**
 * Metadata about a compliance field requirement
 */
export const complianceFieldMetadataSchema = z.object({
  binding: z.string(), // Dot-notation path (e.g., "seller.name", "invoiceNumber")
  label: z.string(), // Human-readable label
  required: z.boolean(), // Whether field is mandatory
  region: z.array(invoiceRegionSchema), // Regions where this applies
  description: z.string().optional(), // Help text
  format: z.enum(["string", "number", "date", "boolean", "object", "array"]).optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(), // Regex pattern
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});

export type ComplianceFieldMetadata = z.infer<typeof complianceFieldMetadataSchema>;

/**
 * Compliance schema definition
 */
export const complianceSchemaDefinitionSchema = z.object({
  region: invoiceRegionSchema,
  name: z.string(), // e.g., "USA Invoice Requirements"
  description: z.string().optional(),
  requiredFields: z.array(complianceFieldMetadataSchema),
  optionalFields: z.array(complianceFieldMetadataSchema).optional(),
  autoFooter: z.string().optional(), // Auto-generated legal footer text
  legalClauses: z.array(z.object({
    condition: z.string().optional(), // Condition when to show (e.g., "reverseCharge")
    text: z.string(), // Legal text to display
  })).optional(),
});

export type ComplianceSchemaDefinition = z.infer<typeof complianceSchemaDefinitionSchema>;

// ============================================================================
// Compliance Registry
// ============================================================================

/**
 * Pre-defined compliance schemas for each region
 */
export const COMPLIANCE_SCHEMAS: Record<InvoiceRegion, ComplianceSchemaDefinition> = {
  US: {
    region: "US",
    name: "USA Invoice Requirements",
    description: "Compliance requirements for invoices in the United States",
    requiredFields: [
      {
        binding: "invoiceNumber",
        label: "Invoice Number",
        required: true,
        region: ["US"],
        description: "Unique sequential invoice number",
        format: "string",
      },
      {
        binding: "invoiceDate",
        label: "Invoice Date",
        required: true,
        region: ["US"],
        description: "Date when invoice was issued",
        format: "date",
      },
      {
        binding: "seller.name",
        label: "Seller Business Name",
        required: true,
        region: ["US"],
        format: "string",
      },
      {
        binding: "seller.address",
        label: "Seller Address",
        required: true,
        region: ["US"],
        format: "object",
      },
      {
        binding: "customer.name",
        label: "Customer Name",
        required: true,
        region: ["US"],
        format: "string",
      },
      {
        binding: "items",
        label: "Invoice Items",
        required: true,
        region: ["US"],
        description: "At least one line item required",
        format: "array",
      },
      {
        binding: "total",
        label: "Total Amount",
        required: true,
        region: ["US"],
        format: "number",
      },
    ],
    optionalFields: [
      {
        binding: "seller.taxId",
        label: "Seller Tax ID (EIN)",
        required: false,
        region: ["US"],
        format: "string",
      },
      {
        binding: "dueDate",
        label: "Due Date",
        required: false,
        region: ["US"],
        format: "date",
      },
      {
        binding: "taxRate",
        label: "Tax Rate",
        required: false,
        region: ["US"],
        format: "number",
      },
      {
        binding: "taxAmount",
        label: "Tax Amount",
        required: false,
        region: ["US"],
        format: "number",
      },
    ],
    autoFooter: "Amounts include applicable state sales tax where required.",
  },
  EU: {
    region: "EU",
    name: "EU Invoice Requirements",
    description: "Compliance requirements for invoices in the European Union (Directive 2006/112/EC)",
    requiredFields: [
      {
        binding: "invoiceNumber",
        label: "Invoice Number",
        required: true,
        region: ["EU"],
        description: "Sequential, unique invoice number (legally mandatory)",
        format: "string",
      },
      {
        binding: "invoiceDate",
        label: "Invoice Date",
        required: true,
        region: ["EU"],
        description: "Date when invoice was issued (legally mandatory)",
        format: "date",
      },
      {
        binding: "supplier.name",
        label: "Supplier Name",
        required: true,
        region: ["EU"],
        format: "string",
      },
      {
        binding: "supplier.address",
        label: "Supplier Address",
        required: true,
        region: ["EU"],
        format: "object",
      },
      {
        binding: "supplier.vatId",
        label: "Supplier VAT ID",
        required: true,
        region: ["EU"],
        description: "VAT identification number (mandatory for cross-border)",
        format: "string",
      },
      {
        binding: "customer.name",
        label: "Customer Name",
        required: true,
        region: ["EU"],
        format: "string",
      },
      {
        binding: "customer.address",
        label: "Customer Address",
        required: true,
        region: ["EU"],
        format: "object",
      },
      {
        binding: "items",
        label: "Invoice Items",
        required: true,
        region: ["EU"],
        description: "At least one line item required",
        format: "array",
      },
      {
        binding: "netAmount",
        label: "Net Amount",
        required: true,
        region: ["EU"],
        format: "number",
      },
      {
        binding: "vatTotal",
        label: "Total VAT Amount",
        required: true,
        region: ["EU"],
        format: "number",
      },
      {
        binding: "grossTotal",
        label: "Gross Total",
        required: true,
        region: ["EU"],
        format: "number",
      },
      {
        binding: "currency",
        label: "Currency",
        required: true,
        region: ["EU"],
        description: "ISO currency code (e.g., EUR, GBP)",
        format: "string",
      },
    ],
    optionalFields: [
      {
        binding: "customer.vatId",
        label: "Customer VAT ID",
        required: false,
        region: ["EU"],
        format: "string",
      },
      {
        binding: "supplyDate",
        label: "Supply Date",
        required: false,
        region: ["EU"],
        description: "Required if different from invoice date",
        format: "date",
      },
      {
        binding: "dueDate",
        label: "Due Date",
        required: false,
        region: ["EU"],
        format: "date",
      },
    ],
    autoFooter: "This invoice complies with EU Council Directive 2006/112/EC on VAT.",
    legalClauses: [
      {
        condition: "reverseCharge",
        text: "Reverse charge — VAT to be accounted for by the recipient.",
      },
    ],
  },
  CA: {
    region: "CA",
    name: "Canada Invoice Requirements",
    description: "Compliance requirements for invoices in Canada",
    requiredFields: [
      {
        binding: "invoiceNumber",
        label: "Invoice Number",
        required: true,
        region: ["CA"],
        format: "string",
      },
      {
        binding: "invoiceDate",
        label: "Invoice Date",
        required: true,
        region: ["CA"],
        format: "date",
      },
      {
        binding: "seller.name",
        label: "Seller Business Name",
        required: true,
        region: ["CA"],
        format: "string",
      },
      {
        binding: "customer.name",
        label: "Customer Name",
        required: true,
        region: ["CA"],
        format: "string",
      },
      {
        binding: "items",
        label: "Invoice Items",
        required: true,
        region: ["CA"],
        format: "array",
      },
      {
        binding: "total",
        label: "Total Amount",
        required: true,
        region: ["CA"],
        format: "number",
      },
    ],
    autoFooter: "Amounts include applicable GST/HST where required.",
  },
  AU: {
    region: "AU",
    name: "Australia Invoice Requirements",
    description: "Compliance requirements for invoices in Australia",
    requiredFields: [
      {
        binding: "invoiceNumber",
        label: "Invoice Number",
        required: true,
        region: ["AU"],
        format: "string",
      },
      {
        binding: "invoiceDate",
        label: "Invoice Date",
        required: true,
        region: ["AU"],
        format: "date",
      },
      {
        binding: "seller.name",
        label: "Seller Business Name",
        required: true,
        region: ["AU"],
        format: "string",
      },
      {
        binding: "customer.name",
        label: "Customer Name",
        required: true,
        region: ["AU"],
        format: "string",
      },
      {
        binding: "items",
        label: "Invoice Items",
        required: true,
        region: ["CA"],
        format: "array",
      },
      {
        binding: "total",
        label: "Total Amount",
        required: true,
        region: ["AU"],
        format: "number",
      },
    ],
    autoFooter: "Amounts include applicable GST where required.",
  },
  UK: {
    region: "UK",
    name: "United Kingdom Invoice Requirements",
    description: "Compliance requirements for invoices in the United Kingdom",
    requiredFields: [
      {
        binding: "invoiceNumber",
        label: "Invoice Number",
        required: true,
        region: ["UK"],
        format: "string",
      },
      {
        binding: "invoiceDate",
        label: "Invoice Date",
        required: true,
        region: ["UK"],
        format: "date",
      },
      {
        binding: "supplier.name",
        label: "Supplier Name",
        required: true,
        region: ["UK"],
        format: "string",
      },
      {
        binding: "supplier.vatId",
        label: "Supplier VAT ID",
        required: true,
        region: ["UK"],
        format: "string",
      },
      {
        binding: "customer.name",
        label: "Customer Name",
        required: true,
        region: ["UK"],
        format: "string",
      },
      {
        binding: "items",
        label: "Invoice Items",
        required: true,
        region: ["UK"],
        format: "array",
      },
      {
        binding: "netAmount",
        label: "Net Amount",
        required: true,
        region: ["UK"],
        format: "number",
      },
      {
        binding: "vatTotal",
        label: "Total VAT Amount",
        required: true,
        region: ["UK"],
        format: "number",
      },
      {
        binding: "grossTotal",
        label: "Gross Total",
        required: true,
        region: ["UK"],
        format: "number",
      },
    ],
    autoFooter: "This invoice complies with UK VAT regulations.",
  },
};

// ============================================================================
// Validation Result Types
// ============================================================================

export const complianceValidationResultSchema = z.object({
  valid: z.boolean(),
  region: invoiceRegionSchema,
  missingFields: z.array(z.object({
    binding: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

export type ComplianceValidationResult = z.infer<typeof complianceValidationResultSchema>;

