import { useEffect, useState } from "react";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Organization } from "@/core/entities/organization";
import type { Template } from "@/core/entities/template";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";

type MissingField = {
  fieldId: string;
  binding?: string;
  label: string;
  description?: string;
};

type ComplianceValidationState = {
  valid: boolean;
  region: string;
  missingFields: MissingField[];
  warnings?: string[];
  errors?: string[];
} | null;

interface UseInvoiceComplianceValidationProps {
  selectedTemplate: Template | undefined;
  currentOrganization: Organization | null | undefined;
  formData: Record<string, InvoiceDataValue>;
}

export function useInvoiceComplianceValidation({
  selectedTemplate,
  currentOrganization,
  formData,
}: UseInvoiceComplianceValidationProps) {
  const [complianceValidation, setComplianceValidation] =
    useState<ComplianceValidationState>(null);

  useEffect(() => {
    if (
      !selectedTemplate ||
      !currentOrganization ||
      Object.keys(formData).length === 0
    ) {
      setComplianceValidation(null);
      return;
    }

    const semanticMode = Boolean(
      selectedTemplate.compliance?.region && selectedTemplate.compliance?.mode,
    );
    const orgAdditionalRequired =
      currentOrganization.settings?.complianceDefaults?.additionalRequired ?? [];

    if (semanticMode) {
      const missing = invoiceComplianceService.validateInvoiceByFieldId(
        selectedTemplate,
        orgAdditionalRequired,
        formData,
      );
      setComplianceValidation({
        valid: missing.length === 0,
        region: selectedTemplate.compliance!.region ?? "US",
        missingFields: missing.map((field) => ({
          fieldId: field.fieldId,
          binding: field.fieldId,
          label: field.label,
          description: field.description,
        })),
      });
      return;
    }

    const region =
      selectedTemplate.compliance?.region ||
      invoiceComplianceService.detectRegion(currentOrganization);
    const invoiceData = {
      orgId: currentOrganization.id,
      commercialCaseId: "VALIDATION_CASE",
      templateId: selectedTemplate.id,
      data: formData,
      status: "unsent" as const,
    };

    const validation = invoiceComplianceService.validateInvoice(invoiceData, region);
    setComplianceValidation({
      valid: validation.valid,
      region: validation.region,
      missingFields: validation.missingFields.map((field) => ({
        fieldId: field.binding,
        binding: field.binding,
        label: field.label,
        description: field.description,
      })),
      warnings: validation.warnings,
      errors: validation.errors,
    });
  }, [formData, selectedTemplate, currentOrganization]);

  return { complianceValidation };
}
