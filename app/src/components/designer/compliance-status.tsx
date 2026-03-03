import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import type { Template } from "@/core";
import type { TemplateComplianceStatus } from "@/hooks/use-template-compliance";
import type { MissingRequiredField } from "./missing-required-fields-panel";

type ComplianceStatusProps = {
  complianceStatus: TemplateComplianceStatus | null;
  template: Template | undefined;
  onAddRequiredElement: (field: MissingRequiredField) => void;
};

export function ComplianceStatus({
  complianceStatus,
  template,
  onAddRequiredElement,
}: ComplianceStatusProps) {
  const { t } = useTranslation();
  if (!complianceStatus || !template) return null;

  const missing = complianceStatus.missingFields.map<MissingRequiredField>((f) => ({
    id: f.id,
    binding: f.id,
    label: f.label,
    description: f.description,
    format: f.format,
    suggestedElementType: f.suggestedElementType,
  }));

  return (
    <Alert>
      {complianceStatus.valid ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle>
        {t("designer.propertiesPanel.compliance")} ({complianceStatus.region}) ·{" "}
        {complianceStatus.coveredCount}/{complianceStatus.totalCount}
      </AlertTitle>
      <AlertDescription>
        {complianceStatus.valid ? (
          <p>{t("designer.compliance.fullyCompliant", "Template is compliant.")}</p>
        ) : (
          <div className="space-y-1">
            {missing.map((field) => (
              <button
                key={field.id}
                type="button"
                className="flex items-center gap-2 text-left text-xs hover:underline"
                onClick={() => onAddRequiredElement(field)}
              >
                <Plus className="h-3 w-3" />
                <span>{field.label}</span>
              </button>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
