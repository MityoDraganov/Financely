import { useState, useEffect } from "react";
import { Plus, X, Lock, AlertTriangle, ArrowRight, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldTypeSelector } from "@/components/content/field-type-selector";
import { CreateMetafieldDefinitionInput, MetafieldDefinition, UpdateMetafieldDefinitionInput } from "@/core";
import { useMetaobjectDefinitions } from "@/hooks/repository-hooks/use-metaobjects";

interface ProductMetafieldDefinitionFormProps {
  initialData?: MetafieldDefinition;
  onSubmit: (data: CreateMetafieldDefinitionInput | UpdateMetafieldDefinitionInput) => Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
  organizationId: string;
  availableCategories?: string[];
  currentCategory?: string | null;
  showCategories?: boolean;
  /** Whether any product has a value for this definition. Locks type & metaobject ref. */
  hasValues?: boolean;
  /**
   * Maps stored option value-keys → how many products currently use them.
   * Drives per-option delete behaviour (migrate or clear, never orphan).
   */
  inUseOptionValues?: Map<string, number>;
  /**
   * Called when the user confirms deletion of an in-use option.
   * `newValue` is the target option value to migrate to, or null to clear.
   * The parent is responsible for the batch update.
   */
  onMigrateOptionValue?: (
    oldValue: string,
    newValue: string | null,
    affectedCount: number
  ) => Promise<void>;
}

const SELECT_METAFIELD_TYPE: MetafieldDefinition["type"] = "single_line_text_field_choice_list";
const DATE_METAFIELD_TYPE: MetafieldDefinition["type"] = "date";

type SelectOption = { label: string; value: string };
type DateConfig = {
  selectionMode: "single" | "period";
  precision: "date" | "month";
  displayMode: "numeric" | "localized";
};
type DeleteAction = "migrate" | "clear";

type PendingDelete = {
  index: number;
  option: SelectOption;
  affectedCount: number;
  action: DeleteAction;
  migrateTo: string;
};

const DEFAULT_DATE_CONFIG: DateConfig = {
  selectionMode: "single",
  precision: "date",
  displayMode: "numeric",
};

const createEmptySelectOption = (): SelectOption => ({ label: "", value: "" });

const normalizeSelectOptions = (options: SelectOption[] | undefined): SelectOption[] =>
  (options || [])
    .map((o) => ({ label: o.label.trim(), value: o.value.trim() }))
    .filter((o) => o.label.length > 0 && o.value.length > 0);

const getInitialSelectOptions = (definition?: MetafieldDefinition): SelectOption[] => {
  const existing = (definition?.options?.selectOptions || []) as SelectOption[];
  return existing.length > 0
    ? existing.map((o) => ({ label: o.label, value: o.value }))
    : [];
};

const getInitialDateConfig = (definition?: MetafieldDefinition): DateConfig => {
  const dc = definition?.options?.dateConfig;
  return {
    selectionMode: dc?.selectionMode || DEFAULT_DATE_CONFIG.selectionMode,
    precision: dc?.precision || DEFAULT_DATE_CONFIG.precision,
    displayMode: dc?.displayMode || DEFAULT_DATE_CONFIG.displayMode,
  };
};

function formatTypeName(type: string): string {
  return type
    .replace(/^list\./, "List · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Delete-option confirmation dialog ──────────────────────────────────────

function DeleteOptionDialog({
  pending,
  otherOptions,
  isMigrating,
  onConfirm,
  onCancel,
  onChange,
}: {
  pending: PendingDelete;
  otherOptions: SelectOption[];
  isMigrating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onChange: (next: Partial<PendingDelete>) => void;
}) {
  const count = pending.affectedCount;
  const productLabel = count === 1 ? "product" : "products";
  const canMigrate = otherOptions.length > 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Remove "{pending.option.label}"?</DialogTitle>
          <DialogDescription>
            {count} {productLabel} currently {count === 1 ? "has" : "have"} this option selected.
            Choose what to do with {count === 1 ? "that record" : "those records"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {/* Option A: migrate */}
          {canMigrate && (
            <label
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                pending.action === "migrate" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                className="mt-0.5 shrink-0"
                checked={pending.action === "migrate"}
                onChange={() => onChange({ action: "migrate" })}
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  Switch to another option
                </div>
                {pending.action === "migrate" && (
                  <Select
                    value={pending.migrateTo}
                    onValueChange={(v) => onChange({ migrateTo: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Choose replacement…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {opt.value}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  All {count} {productLabel} will be updated to the chosen option.
                </p>
              </div>
            </label>
          )}

          {/* Option B: clear */}
          <label
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              pending.action === "clear" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <input
              type="radio"
              className="mt-0.5 shrink-0"
              checked={pending.action === "clear"}
              onChange={() => onChange({ action: "clear" })}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Eraser className="h-3.5 w-3.5 text-muted-foreground" />
                Clear the field on all {count} {productLabel}
              </div>
              <p className="text-xs text-muted-foreground">
                The field will be empty until filled again.
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isMigrating}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isMigrating || (pending.action === "migrate" && !pending.migrateTo)}
          >
            {isMigrating ? "Updating…" : "Confirm & remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────

export function ProductMetafieldDefinitionForm({
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
  organizationId,
  availableCategories = [],
  currentCategory,
  showCategories = true,
  hasValues = false,
  inUseOptionValues,
  onMigrateOptionValue,
}: ProductMetafieldDefinitionFormProps) {
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState<Partial<CreateMetafieldDefinitionInput>>({
    name: initialData?.name || "",
    label: initialData?.label || "",
    type: initialData?.type || "single_line_text_field",
    description: initialData?.description || "",
    categoryAssignments: initialData?.categoryAssignments || [],
    metaobjectDefinitionId: initialData?.metaobjectDefinitionId,
    options: {
      storefrontApiAccess: initialData?.options?.storefrontApiAccess || false,
      publicVisible: initialData?.options?.publicVisible || false,
      selectOptions: getInitialSelectOptions(initialData),
      dateConfig: getInitialDateConfig(initialData),
    },
  });

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const { data: metaobjectDefinitions = [] } = useMetaobjectDefinitions(organizationId);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        label: initialData.label || "",
        type: initialData.type,
        description: initialData.description,
        categoryAssignments: initialData.categoryAssignments || [],
        metaobjectDefinitionId: initialData.metaobjectDefinitionId,
        options: {
          storefrontApiAccess: initialData.options?.storefrontApiAccess || false,
          publicVisible: initialData.options?.publicVisible || false,
          selectOptions: getInitialSelectOptions(initialData),
          dateConfig: getInitialDateConfig(initialData),
        },
      });
    }
  }, [initialData]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.type) return;

    const normalizedMetaobjectDefinitionId =
      formData.type === "metaobject_reference" &&
      typeof formData.metaobjectDefinitionId === "string" &&
      formData.metaobjectDefinitionId.trim().length > 0
        ? formData.metaobjectDefinitionId.trim()
        : undefined;

    const normalizedSelectOptions =
      formData.type === SELECT_METAFIELD_TYPE
        ? normalizeSelectOptions(formData.options?.selectOptions as SelectOption[] | undefined)
        : [];

    if (formData.type === SELECT_METAFIELD_TYPE && normalizedSelectOptions.length === 0) return;

    const nextOptions = {
      storefrontApiAccess: formData.options?.storefrontApiAccess || false,
      publicVisible: formData.options?.publicVisible || false,
      selectOptions: normalizedSelectOptions,
      dateConfig: {
        selectionMode: formData.options?.dateConfig?.selectionMode || DEFAULT_DATE_CONFIG.selectionMode,
        precision: formData.options?.dateConfig?.precision || DEFAULT_DATE_CONFIG.precision,
        displayMode: formData.options?.dateConfig?.displayMode || DEFAULT_DATE_CONFIG.displayMode,
      },
    };

    if (isEditMode) {
      await onSubmit({
        name: formData.name,
        label: formData.label || undefined,
        type: formData.type,
        description: formData.description,
        categoryAssignments: formData.categoryAssignments,
        options: nextOptions,
        ...(normalizedMetaobjectDefinitionId ? { metaobjectDefinitionId: normalizedMetaobjectDefinitionId } : {}),
      } as UpdateMetafieldDefinitionInput);
    } else {
      await onSubmit({
        organizationId,
        name: formData.name,
        label: formData.label || undefined,
        type: formData.type!,
        description: formData.description,
        categoryAssignments: formData.categoryAssignments || [],
        options: nextOptions,
        ...(normalizedMetaobjectDefinitionId ? { metaobjectDefinitionId: normalizedMetaobjectDefinitionId } : {}),
      } as CreateMetafieldDefinitionInput);
    }
  };

  const selectOptions = (formData.options?.selectOptions as SelectOption[] | undefined) || [];
  const hasValidSelectOptions = normalizeSelectOptions(selectOptions).length > 0;

  const updateSelectOptions = (options: SelectOption[]) => {
    setFormData((prev) => ({
      ...prev,
      options: {
        storefrontApiAccess: prev.options?.storefrontApiAccess || false,
        publicVisible: prev.options?.publicVisible || false,
        selectOptions: options,
        dateConfig: prev.options?.dateConfig || DEFAULT_DATE_CONFIG,
      },
    }));
  };

  const updateDateConfig = (dateConfig: DateConfig) => {
    setFormData((prev) => ({
      ...prev,
      options: {
        storefrontApiAccess: prev.options?.storefrontApiAccess || false,
        publicVisible: prev.options?.publicVisible || false,
        selectOptions: (prev.options?.selectOptions as SelectOption[] | undefined) || [],
        dateConfig,
      },
    }));
  };

  const dateConfig = {
    selectionMode: formData.options?.dateConfig?.selectionMode || DEFAULT_DATE_CONFIG.selectionMode,
    precision: formData.options?.dateConfig?.precision || DEFAULT_DATE_CONFIG.precision,
    displayMode: formData.options?.dateConfig?.displayMode || DEFAULT_DATE_CONFIG.displayMode,
  } as DateConfig;

  // Delete button logic: free delete if not in use; dialog if in use
  const handleDeleteOptionClick = (index: number, option: SelectOption) => {
    const count = inUseOptionValues?.get(option.value) ?? 0;
    if (count === 0) {
      updateSelectOptions(selectOptions.filter((_, i) => i !== index));
      return;
    }
    const otherOptions = selectOptions.filter((_, i) => i !== index);
    setPendingDelete({
      index,
      option,
      affectedCount: count,
      action: otherOptions.length > 0 ? "migrate" : "clear",
      migrateTo: otherOptions[0]?.value ?? "",
    });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsMigrating(true);
    try {
      await onMigrateOptionValue?.(
        pendingDelete.option.value,
        pendingDelete.action === "migrate" ? pendingDelete.migrateTo : null,
        pendingDelete.affectedCount
      );
      updateSelectOptions(selectOptions.filter((_, i) => i !== pendingDelete.index));
      setPendingDelete(null);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Warning banner when type is locked */}
      {isEditMode && hasValues && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Field type is locked</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Products already have values for this field. The type cannot be changed to prevent data corruption.
            </p>
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <Label htmlFor="metafield-name">Name *</Label>
        <Input
          id="metafield-name"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Product Feature"
        />
      </div>

      {/* Label */}
      <div>
        <Label htmlFor="metafield-label">
          Label{" "}
          <span className="font-normal text-muted-foreground">(public display name)</span>
        </Label>
        <Input
          id="metafield-label"
          value={formData.label || ""}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder={formData.name || "Shown on public product pages — defaults to Name if empty"}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Overrides the field name shown to visitors on public product pages.
        </p>
      </div>

      {/* Type */}
      <div>
        <Label>Type *</Label>
        {isEditMode && hasValues ? (
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-mono flex-1">{formatTypeName(formData.type || "")}</span>
            <span className="text-xs text-muted-foreground">Locked</span>
          </div>
        ) : (
          <FieldTypeSelector
            value={formData.type as Exclude<MetafieldDefinition["type"], `list.${string}`>}
            onSelect={(type) => {
              const newType = type as MetafieldDefinition["type"];
              const isSelect = newType === SELECT_METAFIELD_TYPE;
              setFormData({
                ...formData,
                type: newType,
                metaobjectDefinitionId: newType === "metaobject_reference" ? formData.metaobjectDefinitionId : undefined,
                options: {
                  storefrontApiAccess: formData.options?.storefrontApiAccess || false,
                  publicVisible: formData.options?.publicVisible || false,
                  selectOptions: isSelect
                    ? (selectOptions.length > 0 ? selectOptions : [createEmptySelectOption()])
                    : [],
                  dateConfig: formData.options?.dateConfig || DEFAULT_DATE_CONFIG,
                },
              });
            }}
          />
        )}
      </div>

      {/* Date config */}
      {formData.type === DATE_METAFIELD_TYPE && (
        <div className="space-y-3 rounded-lg border p-3">
          <Label>Date behavior</Label>
          <div className="grid gap-3 grid-cols-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Value mode</Label>
              <Select
                value={dateConfig.selectionMode}
                onValueChange={(value: DateConfig["selectionMode"]) =>
                  updateDateConfig({ ...dateConfig, selectionMode: value })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single value</SelectItem>
                  <SelectItem value="period">Period (start/end)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Precision</Label>
              <Select
                value={dateConfig.precision}
                onValueChange={(value: DateConfig["precision"]) =>
                  updateDateConfig({ ...dateConfig, precision: value })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Exact date</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Display format</Label>
              <Select
                value={dateConfig.displayMode}
                onValueChange={(value: DateConfig["displayMode"]) =>
                  updateDateConfig({ ...dateConfig, displayMode: value })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="localized">Localized month names</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Numeric keeps ISO-like values. Localized shows month names using visitor language.
          </p>
        </div>
      )}

      {/* Select options */}
      {formData.type === SELECT_METAFIELD_TYPE && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Select options *</Label>
            <span className="text-xs text-muted-foreground">{selectOptions.length} option(s)</span>
          </div>

          {selectOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add at least one option.</p>
          ) : (
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-0.5">
                <span className="text-xs text-muted-foreground">Value key (stored)</span>
                <span className="text-xs text-muted-foreground">Display label</span>
                <span />
              </div>

              {selectOptions.map((option, index) => {
                const usageCount = inUseOptionValues?.get(option.value) ?? 0;
                const isInUse = usageCount > 0;

                return (
                  <div
                    key={`option-${index}`}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                  >
                    {/* Value key — locked only if this value is in use */}
                    <div className="relative">
                      <Input
                        value={option.value}
                        onChange={(e) => {
                          if (isInUse) return;
                          const next = [...selectOptions];
                          next[index] = { ...next[index], value: e.target.value };
                          updateSelectOptions(next);
                        }}
                        placeholder="e.g. active"
                        disabled={isInUse}
                        title={isInUse ? `${usageCount} product(s) use this value — key is locked` : undefined}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Label — always editable */}
                    <Input
                      value={option.label}
                      onChange={(e) => {
                        const next = [...selectOptions];
                        next[index] = { ...next[index], label: e.target.value };
                        updateSelectOptions(next);
                      }}
                      placeholder="e.g. Active"
                    />

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title={
                        isInUse
                          ? `${usageCount} product(s) use this — click to migrate or clear`
                          : "Remove option"
                      }
                      onClick={() => handleDeleteOptionClick(index, option)}
                    >
                      {isInUse ? (
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}

              {/* Hint for locked rows */}
              {inUseOptionValues && inUseOptionValues.size > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <Lock className="h-3 w-3 shrink-0" />
                  Options with a lock are in use. Click the lock to migrate or clear affected products before removing.
                </p>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateSelectOptions([...selectOptions, createEmptySelectOption()])}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add option
          </Button>

          {!hasValidSelectOptions && (
            <p className="text-xs text-destructive">At least one option with both label and value is required.</p>
          )}
        </div>
      )}

      {/* Metaobject reference — locked if values exist */}
      {formData.type === "metaobject_reference" && (
        <div>
          <Label htmlFor="metaobject-definition">Metaobject definition *</Label>
          {isEditMode && hasValues ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">
                {metaobjectDefinitions.find((d) => d.id === formData.metaobjectDefinitionId)?.name ??
                  formData.metaobjectDefinitionId ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">Locked</span>
            </div>
          ) : (
            <>
              <Select
                value={formData.metaobjectDefinitionId || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, metaobjectDefinitionId: value || undefined })
                }
              >
                <SelectTrigger id="metaobject-definition">
                  <SelectValue placeholder="Select a metaobject definition" />
                </SelectTrigger>
                <SelectContent>
                  {metaobjectDefinitions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No metaobject definitions available
                    </div>
                  ) : (
                    metaobjectDefinitions.map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select which metaobject type this metafield will reference
              </p>
            </>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <Label htmlFor="metafield-description">Description</Label>
        <Textarea
          id="metafield-description"
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="metafield-public-visible" className="cursor-pointer">
            Visible on public product pages
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only enabled metafields are shown to external visitors.
          </p>
        </div>
        <input
          id="metafield-public-visible"
          type="checkbox"
          checked={Boolean(formData.options?.publicVisible)}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              options: {
                storefrontApiAccess: prev.options?.storefrontApiAccess || false,
                publicVisible: e.target.checked,
                selectOptions: (prev.options?.selectOptions as SelectOption[] | undefined) || [],
                dateConfig: prev.options?.dateConfig || DEFAULT_DATE_CONFIG,
              },
            }))
          }
          className="rounded border-border"
        />
      </div>

      {/* Category assignments */}
      {showCategories && (
        <div>
          <Label>Category assignments</Label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories found. Create products with categories first.
              </p>
            ) : (
              availableCategories.map((category) => (
                <div key={category} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={formData.categoryAssignments?.includes(category) || false}
                    onChange={(e) => {
                      const current = formData.categoryAssignments || [];
                      setFormData({
                        ...formData,
                        categoryAssignments: e.target.checked
                          ? [...current, category]
                          : current.filter((c) => c !== category),
                      });
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`category-${category}`} className="text-sm font-normal cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showCategories && currentCategory && (
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <input
            type="checkbox"
            id="assign-to-current-category"
            checked={formData.categoryAssignments?.includes(currentCategory) || false}
            onChange={(e) => {
              const current = formData.categoryAssignments || [];
              setFormData({
                ...formData,
                categoryAssignments: e.target.checked
                  ? [...current, currentCategory]
                  : current.filter((c) => c !== currentCategory),
              });
            }}
            className="rounded border-border"
          />
          <Label htmlFor="assign-to-current-category" className="cursor-pointer">
            Assign to current category ({currentCategory})
          </Label>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            isPending ||
            !formData.name ||
            !formData.type ||
            (formData.type === "metaobject_reference" && !formData.metaobjectDefinitionId) ||
            (formData.type === SELECT_METAFIELD_TYPE && !hasValidSelectOptions)
          }
        >
          {isPending
            ? isEditMode ? "Updating…" : "Creating…"
            : isEditMode ? "Update" : "Create"}
        </Button>
      </div>

      {/* Migrate / clear dialog */}
      {pendingDelete && (
        <DeleteOptionDialog
          pending={pendingDelete}
          otherOptions={selectOptions.filter((_, i) => i !== pendingDelete.index)}
          isMigrating={isMigrating}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
          onChange={(next) => setPendingDelete((prev) => prev ? { ...prev, ...next } : prev)}
        />
      )}
    </div>
  );
}
