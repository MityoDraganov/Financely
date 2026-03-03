import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TemplateComplianceStatus } from "@/hooks/use-template-compliance";
import type { FieldFormat } from "@/core/entities/field-catalog";

export type MissingRequiredField = {
  id: string;
  binding?: string;
  label: string;
  description?: string;
  format?: FieldFormat;
  suggestedElementType: "text" | "input" | "table" | "currency";
};

type CompliancePanelProps = {
  complianceStatus: TemplateComplianceStatus | null;
  onAddRequiredElement: (field: MissingRequiredField) => void;
  showToast?: boolean;
  className?: string;
  storageKey?: string;
};

export function CompliancePanel({
  complianceStatus,
  onAddRequiredElement,
  showToast = true,
  className,
  storageKey = "default",
}: CompliancePanelProps) {
  const localStorageKey = useMemo(
    () => `designer:compliance-panel:${storageKey}`,
    [storageKey],
  );
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(localStorageKey);
    if (raw === "expanded") setCollapsed(false);
    if (raw === "collapsed") setCollapsed(true);
  }, [localStorageKey]);

  useEffect(() => {
    localStorage.setItem(localStorageKey, collapsed ? "collapsed" : "expanded");
  }, [collapsed, localStorageKey]);

  if (!complianceStatus) return null;

  const missingIds = new Set(
    complianceStatus.missingFields.map((field) => field.id),
  );
  const requiredById = new Map(
    complianceStatus.requiredFields.map((field) => [field.id, field] as const),
  );
  // Defensive merge to keep panel consistent even if upstream missingFields contains
  // an ID not present in requiredFields.
  for (const field of complianceStatus.missingFields) {
    if (!requiredById.has(field.id)) {
      requiredById.set(field.id, field);
    }
  }
  const requiredFields: Array<MissingRequiredField & { isPresent: boolean }> = [
    ...requiredById.values(),
  ]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((field) => ({
      id: field.id,
      binding: field.id,
      label: field.label,
      description: field.description,
      format: field.format,
      suggestedElementType: field.suggestedElementType,
      isPresent: !missingIds.has(field.id),
    }));
  const totalCount = requiredFields.length;
  const coveredCount = requiredFields.filter((field) => field.isPresent).length;
  const isValid = coveredCount === totalCount;

  return (
    <div className={cn("rounded-lg border bg-card/40 p-2", className)}>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
      >
        {isValid ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Lock className="h-4 w-4 text-amber-600" />
        )}
        <span className="text-sm font-medium">
          Compliance ({complianceStatus.region})
        </span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
            isValid
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700",
          )}
        >
          {coveredCount}/{totalCount}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            !collapsed && "rotate-180",
          )}
        />
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-1.5 px-2 pb-1">
          {requiredFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No required fields.</p>
          ) : (
            requiredFields.map((field) =>
              field.isPresent ? (
                <div
                  key={field.id}
                  className="flex w-full items-start gap-2 rounded-md border border-emerald-200/70 bg-emerald-50/40 px-2 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-emerald-800 line-through">
                      {field.label}
                    </span>
                    {field.description && (
                      <span className="block text-xs text-emerald-700/80 line-through">
                        {field.description}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
              <button
                key={field.id}
                type="button"
                onClick={() => {
                  onAddRequiredElement(field);
                  if (showToast) {
                    toast.success(`Added "${field.label}"`);
                  }
                }}
                className="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left hover:bg-muted/50"
              >
                <Plus className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{field.label}</span>
                  {field.description && (
                    <span className="block text-xs text-muted-foreground">
                      {field.description}
                    </span>
                  )}
                </span>
              </button>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
