/**
 * Invoice Compliance Service
 * 
 * Service layer for invoice compliance validation and region detection.
 * Integrates with organization and template data to provide compliance checking.
 */

import type { InvoiceRegion, ComplianceValidationResult } from "@/core/entities/invoice-compliance";
import type { InvoiceData, InvoiceDataValue } from "@/core/entities/invoice";
import type { Template } from "@/core/entities/template";
import type { Organization } from "@/core/entities/organization";
import type { FieldDefinition } from "@/core/entities/field-catalog";
import {
  detectRegionForInvoice,
  validateInvoiceCompliance,
  generateComplianceFooter,
  validateTemplateCompliance,
  getRequiredFieldsForRegion,
  validateTemplateComplianceByFieldId,
  validateInvoiceComplianceByFieldId,
} from "@/utils/invoice-compliance";

export interface ComplianceService {
  /**
   * Detect compliance region for an invoice
   */
  detectRegion(org: Organization, customerCountry?: string): InvoiceRegion;
  
  /**
   * Validate invoice data against compliance requirements
   */
  validateInvoice(
    invoiceData: InvoiceData,
    region: InvoiceRegion
  ): ComplianceValidationResult;
  
  /**
   * Validate template has all required bindings for compliance
   */
  validateTemplate(template: Template, region: InvoiceRegion): {
    valid: boolean;
    missingBindings: string[];
  };
  
  /**
   * Generate compliance footer text
   */
  generateFooter(region: InvoiceRegion, invoiceData?: Record<string, InvoiceDataValue>): string;
  
  /**
   * Get required fields for a region
   */
  getRequiredFields(region: InvoiceRegion): string[];

  /**
   * Validate template using the new field-ID semantic path.
   * Falls back gracefully when compliance config has no mode/region set.
   */
  validateTemplateByFieldId(
    template: Template,
    orgAdditionalRequired?: Array<{ fieldId: string }>,
  ): FieldDefinition[];

  /**
   * Validate invoice data using the new field-ID semantic path.
   */
  validateInvoiceByFieldId(
    template: Template,
    orgAdditionalRequired: Array<{ fieldId: string }> | undefined,
    data: Record<string, InvoiceDataValue>,
  ): Array<{ fieldId: string; label: string; description?: string }>;
}

export const invoiceComplianceService: ComplianceService = {
  detectRegion(org: Organization, customerCountry?: string): InvoiceRegion {
    const orgCountry = org.settings?.country;
    const orgRegion = org.settings?.region;
    
    // Use explicit region if set, otherwise detect from country
    if (orgRegion) {
      return orgRegion;
    }
    
    return detectRegionForInvoice(orgCountry, customerCountry);
  },
  
  validateInvoice(
    invoiceData: InvoiceData,
    region: InvoiceRegion
  ): ComplianceValidationResult {
    return validateInvoiceCompliance(invoiceData.data, region);
  },
  
  validateTemplate(template: Template, region: InvoiceRegion): {
    valid: boolean;
    missingBindings: string[];
  } {
    const missing = validateTemplateCompliance(template.elements, region);
    return {
      valid: missing.length === 0,
      missingBindings: missing,
    };
  },
  
  generateFooter(region: InvoiceRegion, invoiceData?: Record<string, InvoiceDataValue>): string {
    return generateComplianceFooter(region, invoiceData);
  },
  
  getRequiredFields(region: InvoiceRegion): string[] {
    return getRequiredFieldsForRegion(region);
  },

  validateTemplateByFieldId(
    template: Template,
    orgAdditionalRequired: Array<{ fieldId: string }> = [],
  ) {
    return validateTemplateComplianceByFieldId(
      template.elements,
      template.compliance,
      orgAdditionalRequired,
    );
  },

  validateInvoiceByFieldId(
    template: Template,
    orgAdditionalRequired: Array<{ fieldId: string }> = [],
    data: Record<string, InvoiceDataValue>,
  ) {
    return validateInvoiceComplianceByFieldId(
      template.elements ?? [],
      template.compliance,
      orgAdditionalRequired,
      data,
    );
  },
};
