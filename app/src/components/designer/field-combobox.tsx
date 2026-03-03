import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FIELD_CATALOG,
  type FieldDefinition,
  type FieldGroup,
} from "@/core/entities/field-catalog";
import { cn } from "@/lib/utils";
import { resolveBinding } from "@/utils/binding-resolution";

const GROUP_ORDER: FieldGroup[] = [
  "Invoice Info",
  "Seller",
  "Customer",
  "Items",
  "Totals",
  "Tax",
  "Payment",
  "Custom",
];

type FieldComboboxProps = {
  value: string | undefined;
  fieldId: string | undefined;
  onSelect: (fieldId: string, binding: string) => void;
  onCustomBinding: (binding: string) => void;
  orgFields?: FieldDefinition[];
  placeholder?: string;
  className?: string;
  filterElementType?: FieldDefinition["suggestedElementType"];
};

export function FieldCombobox({
  value,
  fieldId,
  onSelect,
  onCustomBinding,
  orgFields = [],
  placeholder = "Select field",
  className,
  filterElementType,
}: FieldComboboxProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(value ?? "");

  const allFields = useMemo(() => {
    const byId = new Map<string, FieldDefinition>();
    for (const field of FIELD_CATALOG) byId.set(field.id, field);
    for (const field of orgFields) byId.set(field.id, field);
    const merged = [...byId.values()];
    return filterElementType
      ? merged.filter((f) => f.suggestedElementType === filterElementType)
      : merged;
  }, [orgFields, filterElementType]);

  const resolvedFieldId = useMemo(() => {
    if (fieldId) return fieldId;
    return resolveBinding(value).fieldId;
  }, [fieldId, value]);

  const selectedField = useMemo(
    () => allFields.find((field) => field.id === resolvedFieldId),
    [allFields, resolvedFieldId],
  );

  const grouped = useMemo(() => {
    const map = new Map<FieldGroup, FieldDefinition[]>();
    for (const group of GROUP_ORDER) {
      const fields = allFields.filter((f) => f.group === group);
      if (fields.length > 0) map.set(group, fields);
    }
    return map;
  }, [allFields]);

  const hasUnknownBinding =
    Boolean(value) && !selectedField && resolveBinding(value).resolved === "unknown";

  const triggerLabel = hasUnknownBinding
    ? value
    : selectedField?.label ?? value ?? placeholder;

  return (
    <div className={cn("space-y-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-8 w-full justify-between text-sm font-normal",
              !value && !selectedField && "text-muted-foreground",
              hasUnknownBinding && "font-mono",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by field name or key..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              {Array.from(grouped.entries()).map(([group, fields], index) => (
                <div key={group}>
                  {index > 0 && <CommandSeparator />}
                  <CommandGroup heading={group}>
                    {fields.map((field) => (
                      <CommandItem
                        key={field.id}
                        value={`${field.label} ${field.id} ${field.description ?? ""} ${(field.aliases ?? []).join(" ")}`}
                        onSelect={() => {
                          onSelect(field.id, field.id);
                          setCustomMode(false);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5 shrink-0",
                            resolvedFieldId === field.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{field.label}</div>
                          {field.description && (
                            <div className="truncate text-xs text-muted-foreground">
                              {field.description}
                            </div>
                          )}
                        </div>
                        <span className="ml-2 shrink-0 text-[11px] font-mono text-muted-foreground">
                          {field.format}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ))}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="advanced custom binding"
                  onSelect={() => {
                    setCustomMode(true);
                    setCustomValue(value ?? "");
                    setOpen(false);
                  }}
                >
                  Advanced: custom binding...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            data key:{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
              {resolvedFieldId ?? value ?? "none"}
            </code>
          </div>
        </PopoverContent>
      </Popover>

      {customMode && (
        <div className="flex items-center gap-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="e.g. seller.customField"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const trimmed = customValue.trim();
              if (!trimmed) return;
              onCustomBinding(trimmed);
              setCustomMode(false);
            }}
          >
            Set
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCustomMode(false);
              setCustomValue(value ?? "");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
