import type { Organization } from "@/core/entities/organization";
import type { Template } from "@/core/entities/template";
import {
  getCatalogField,
  type FieldDefinition,
} from "@/core/entities/field-catalog";
import { COMPLIANCE_SCHEMAS } from "@/core/entities/invoice-compliance";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import {
  getEffectiveRequirements,
  validateTemplateComplianceByFieldId,
} from "@/utils/invoice-compliance";
import { extractTemplateElementFieldId } from "@/utils/binding-resolution";

export type TemplateComplianceStatus = {
  region: string;
  valid: boolean;
  coveredCount: number;
  totalCount: number;
  requiredFields: FieldDefinition[];
  missingFields: FieldDefinition[];
};

export function useTemplateCompliance(
  template: Template | undefined,
  org: Organization | null | undefined,
  orgAdditionalRequired: Array<{ fieldId: string }> = [],
): {
  complianceStatus: TemplateComplianceStatus | null;
  isRequiredField: (fieldId?: string) => boolean;
  elementIsRequired: (el: {
    fieldId?: string;
    binding?: string;
    itemsBinding?: string;
  }) => boolean;
} {
  if (!template) {
    return {
      complianceStatus: null,
      isRequiredField: () => false,
      elementIsRequired: () => false,
    };
  }

  const semanticMode = Boolean(
    template.compliance?.region && template.compliance?.mode,
  );

  if (semanticMode) {
    const requiredFields = getEffectiveRequirements(
      template.compliance,
      orgAdditionalRequired,
    );
    const missingFields = validateTemplateComplianceByFieldId(
      template.elements ?? [],
      template.compliance,
      orgAdditionalRequired,
    );

    const requiredIds = new Set(requiredFields.map((f) => f.id));
    const missingIds = new Set(missingFields.map((f) => f.id));

    const complianceStatus: TemplateComplianceStatus = {
      region: template.compliance!.region ?? "US",
      valid: missingIds.size === 0,
      coveredCount: Math.max(0, requiredIds.size - missingIds.size),
      totalCount: requiredIds.size,
      requiredFields,
      missingFields,
    };

    const isRequiredField = (fieldId?: string) =>
      Boolean(fieldId && requiredIds.has(fieldId));

    const elementIsRequired = (el: {
      fieldId?: string;
      binding?: string;
      itemsBinding?: string;
    }) => {
      const resolved = extractTemplateElementFieldId(el);
      return isRequiredField(resolved);
    };

    return { complianceStatus, isRequiredField, elementIsRequired };
  }

  const region =
    template.compliance?.region ??
    (org ? invoiceComplianceService.detectRegion(org) : "US");

  const legacy = invoiceComplianceService.validateTemplate(template, region);
  const schema = COMPLIANCE_SCHEMAS[region];
  const requiredBindings = new Set(schema.requiredFields.map((f) => f.binding));

  const requiredFields = schema.requiredFields.map((field) => {
    const catalog = getCatalogField(field.binding);
    return (
      catalog ?? {
        id: field.binding,
        label: field.label,
        description: field.description,
        group: "Custom" as const,
        format: field.format ?? "string",
        compliance: {},
        suggestedElementType: "text" as const,
      }
    );
  });

  const missingFields = legacy.missingBindings.map((binding) => {
    const catalog = getCatalogField(binding);
    const schemaField = schema.requiredFields.find((f) => f.binding === binding);
    return (
      catalog ?? {
        id: binding,
        label: schemaField?.label ?? binding,
        description: schemaField?.description,
        group: "Custom" as const,
        format: schemaField?.format ?? "string",
        compliance: {},
        suggestedElementType: "text" as const,
      }
    );
  });

  const requiredIds = new Set(requiredFields.map((f) => f.id));
  const missingIds = new Set(missingFields.map((f) => f.id));

  const complianceStatus: TemplateComplianceStatus = {
    region,
    valid: missingIds.size === 0,
    coveredCount: Math.max(0, requiredIds.size - missingIds.size),
    totalCount: requiredIds.size,
    requiredFields,
    missingFields,
  };

  const isRequiredField = (fieldId?: string) =>
    Boolean(fieldId && requiredIds.has(fieldId));

  const elementIsRequired = (el: {
    fieldId?: string;
    binding?: string;
    itemsBinding?: string;
  }) => {
    const resolved = extractTemplateElementFieldId(el);
    if (resolved) return isRequiredField(resolved);
    const binding = el.itemsBinding ?? el.binding;
    return Boolean(binding && requiredBindings.has(binding));
  };

  return { complianceStatus, isRequiredField, elementIsRequired };
}
