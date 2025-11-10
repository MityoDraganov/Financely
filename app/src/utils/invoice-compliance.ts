/**
 * Invoice Compliance Utilities
 * 
 * Provides utilities for region detection, compliance validation,
 * and auto-footer generation for invoice templates.
 */

import type { InvoiceRegion, ComplianceValidationResult, ComplianceFieldMetadata } from "@/core/entities/invoice-compliance";
import { COMPLIANCE_SCHEMAS } from "@/core/entities/invoice-compliance";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { getBindingValue } from "@/core/entities/invoice";

// ============================================================================
// Region Detection
// ============================================================================

/**
 * Map of ISO country codes to invoice compliance regions
 */
const COUNTRY_TO_REGION_MAP: Record<string, InvoiceRegion> = {
  // United States
  US: "US",
  
  // European Union countries
  AT: "EU", // Austria
  BE: "EU", // Belgium
  BG: "EU", // Bulgaria
  HR: "EU", // Croatia
  CY: "EU", // Cyprus
  CZ: "EU", // Czech Republic
  DK: "EU", // Denmark
  EE: "EU", // Estonia
  FI: "EU", // Finland
  FR: "EU", // France
  DE: "EU", // Germany
  GR: "EU", // Greece
  HU: "EU", // Hungary
  IE: "EU", // Ireland
  IT: "EU", // Italy
  LV: "EU", // Latvia
  LT: "EU", // Lithuania
  LU: "EU", // Luxembourg
  MT: "EU", // Malta
  NL: "EU", // Netherlands
  PL: "EU", // Poland
  PT: "EU", // Portugal
  RO: "EU", // Romania
  SK: "EU", // Slovakia
  SI: "EU", // Slovenia
  ES: "EU", // Spain
  SE: "EU", // Sweden
  
  // Canada
  CA: "CA",
  
  // Australia
  AU: "AU",
  
  // United Kingdom (post-Brexit, but similar to EU)
  GB: "UK",
};

/**
 * Detect invoice compliance region from country code
 * 
 * @param countryCode - ISO country code (e.g., "US", "GB", "DE")
 * @returns Invoice compliance region or "US" as default
 */
export function detectRegionFromCountry(countryCode?: string): InvoiceRegion {
  if (!countryCode) {
    return "US"; // Default to US
  }
  
  const upperCountry = countryCode.toUpperCase();
  return COUNTRY_TO_REGION_MAP[upperCountry] || "US";
}

/**
 * Detect invoice compliance region from organization and customer countries
 * Uses stricter schema (EU) for cross-border transactions
 * 
 * @param orgCountry - Organization country code
 * @param customerCountry - Customer country code (optional)
 * @returns Invoice compliance region
 */
export function detectRegionForInvoice(
  orgCountry?: string,
  customerCountry?: string
): InvoiceRegion {
  const orgRegion = detectRegionFromCountry(orgCountry);
  const customerRegion = customerCountry ? detectRegionFromCountry(customerCountry) : null;
  
  // For cross-border transactions, apply stricter schema
  // If either party is in EU, use EU compliance
  if (orgRegion === "EU" || customerRegion === "EU") {
    return "EU";
  }
  
  // Default to organization region
  return orgRegion;
}

// ============================================================================
// Compliance Validation
// ============================================================================

/**
 * Validate that a binding path exists in invoice data
 */
function validateBindingExists(
  data: Record<string, InvoiceDataValue>,
  binding: string
): boolean {
  const value = getBindingValue(data, binding);
  
  if (value === undefined || value === null) {
    return false;
  }
  
  // Check for empty strings
  if (typeof value === "string" && value.trim() === "") {
    return false;
  }
  
  // Check for empty arrays
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  
  // Check for empty objects
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, InvoiceDataValue>;
    return Object.keys(obj).length > 0;
  }
  
  return true;
}

/**
 * Validate invoice data against compliance schema for a region
 * 
 * @param data - Invoice data to validate
 * @param region - Compliance region to validate against
 * @returns Validation result with missing fields and warnings
 */
export function validateInvoiceCompliance(
  data: Record<string, InvoiceDataValue>,
  region: InvoiceRegion
): ComplianceValidationResult {
  const schema = COMPLIANCE_SCHEMAS[region];
  const missingFields: Array<{ binding: string; label: string; description?: string }> = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validate all required fields
  for (const field of schema.requiredFields) {
    if (!validateBindingExists(data, field.binding)) {
      missingFields.push({
        binding: field.binding,
        label: field.label,
        description: field.description,
      });
    }
  }
  
  // Additional validations for specific regions
  if (region === "EU") {
    // Check if items have VAT information
    const items = getBindingValue(data, "items");
    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, InvoiceDataValue>;
        if (typeof item === "object" && item !== null) {
          if (!item.vatRate && item.vatRate !== 0) {
            warnings.push(`Item ${i + 1} is missing VAT rate (required for EU invoices)`);
          }
          if (!item.vatAmount && item.vatAmount !== 0) {
            warnings.push(`Item ${i + 1} is missing VAT amount (required for EU invoices)`);
          }
        }
      }
    }
    
    // Check for reverse charge note if reverse charge is enabled
    const reverseCharge = getBindingValue(data, "reverseCharge");
    if (reverseCharge === true) {
      const reverseChargeNote = getBindingValue(data, "reverseChargeNote");
      if (!reverseChargeNote || (typeof reverseChargeNote === "string" && reverseChargeNote.trim() === "")) {
        warnings.push("Reverse charge is enabled but reverse charge note is missing");
      }
    }
  }
  
  // Validate totals for EU invoices
  if (region === "EU" || region === "UK") {
    const netAmount = getBindingValue(data, "netAmount");
    const vatTotal = getBindingValue(data, "vatTotal");
    const grossTotal = getBindingValue(data, "grossTotal");
    
    if (typeof netAmount === "number" && typeof vatTotal === "number" && typeof grossTotal === "number") {
      const calculatedGross = netAmount + vatTotal;
      const tolerance = 0.01; // Allow small rounding differences
      if (Math.abs(calculatedGross - grossTotal) > tolerance) {
        errors.push(`Gross total (${grossTotal}) does not match net amount (${netAmount}) + VAT total (${vatTotal})`);
      }
    }
  }
  
  return {
    valid: missingFields.length === 0 && errors.length === 0,
    region,
    missingFields,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get all required field bindings for a region
 * 
 * @param region - Compliance region
 * @returns Array of required field bindings
 */
export function getRequiredFieldsForRegion(region: InvoiceRegion): string[] {
  const schema = COMPLIANCE_SCHEMAS[region];
  return schema.requiredFields.map((field) => field.binding);
}

/**
 * Get field metadata for a specific binding in a region
 * 
 * @param region - Compliance region
 * @param binding - Field binding path
 * @returns Field metadata or undefined if not found
 */
export function getFieldMetadata(
  region: InvoiceRegion,
  binding: string
): ComplianceFieldMetadata | undefined {
  const schema = COMPLIANCE_SCHEMAS[region];
  return schema.requiredFields.find((field) => field.binding === binding) ||
    schema.optionalFields?.find((field) => field.binding === binding);
}

// ============================================================================
// Auto-Footer Generation
// ============================================================================

/**
 * Generate compliance footer text for a region
 * 
 * @param region - Compliance region
 * @param data - Invoice data (for conditional clauses)
 * @returns Footer text
 */
export function generateComplianceFooter(
  region: InvoiceRegion,
  data?: Record<string, InvoiceDataValue>
): string {
  const schema = COMPLIANCE_SCHEMAS[region];
  const footerParts: string[] = [];
  
  // Add auto-footer if available
  if (schema.autoFooter) {
    footerParts.push(schema.autoFooter);
  }
  
  // Add conditional legal clauses
  if (schema.legalClauses && data) {
    for (const clause of schema.legalClauses) {
      if (!clause.condition) {
        // Always show if no condition
        footerParts.push(clause.text);
      } else {
        // Check condition
        const conditionValue = getBindingValue(data, clause.condition);
        if (conditionValue === true) {
          footerParts.push(clause.text);
        }
      }
    }
  }
  
  return footerParts.join(" ");
}

/**
 * Check if a template element binding is required for compliance
 * 
 * @param region - Compliance region
 * @param binding - Element binding path
 * @returns true if binding is required
 */
export function isRequiredBinding(region: InvoiceRegion, binding: string): boolean {
  const schema = COMPLIANCE_SCHEMAS[region];
  return schema.requiredFields.some((field) => field.binding === binding);
}

/**
 * Get all bindings used in template elements
 * Handles different element types: text, input, image have `binding`, tables have `itemsBinding`
 * 
 * @param elements - Template elements
 * @returns Set of unique binding paths
 */
export function extractTemplateBindings(elements: Array<{ 
  type: string;
  binding?: string;
  itemsBinding?: string;
}>): Set<string> {
  const bindings = new Set<string>();
  
  for (const element of elements) {
    // Handle regular bindings (text, input, image elements)
    if (element.binding) {
      bindings.add(element.binding);
    }
    
    // Handle table itemsBinding
    if (element.type === "table" && "itemsBinding" in element && element.itemsBinding) {
      bindings.add(element.itemsBinding);
    }
  }
  
  return bindings;
}

/**
 * Validate template has all required bindings for compliance
 * 
 * @param elements - Template elements
 * @param region - Compliance region
 * @returns Array of missing required bindings
 */
export function validateTemplateCompliance(
  elements: Array<{ 
    type: string;
    binding?: string;
    itemsBinding?: string;
  }>,
  region: InvoiceRegion
): string[] {
  const templateBindings = extractTemplateBindings(elements);
  const requiredBindings = getRequiredFieldsForRegion(region);
  const missing: string[] = [];
  
  for (const required of requiredBindings) {
    if (!templateBindings.has(required)) {
      missing.push(required);
    }
  }
  
  return missing;
}

