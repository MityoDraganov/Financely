import { useState, useRef } from "react";
import { Plus, X, GripVertical, Image as ImageIcon, File as FileIcon, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { MetafieldDefinition } from "@/core";
import { useMetaobjects, useMetaobjectDefinitions, useCreateMetaobject } from "@/hooks/repository-hooks/use-metaobjects";
import { toast } from "sonner";
import { CreateMetaobjectEntryDialog } from "./create-metaobject-entry-dialog";
import { SelectFileDialog } from "./select-file-dialog";
import type { DateRange } from "react-day-picker";

interface MetafieldInputProps {
  definition: MetafieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  organizationId?: string;
}

type SelectOption = {
  label: string;
  value: string;
};

type DateSelectionMode = "single" | "period";
type DatePrecision = "date" | "month";
type DateConfig = {
  selectionMode: DateSelectionMode;
  precision: DatePrecision;
  displayMode: "numeric" | "localized";
};

type MonthToken = {
  month: number;
  year?: number;
};

const EMPTY_SELECT_VALUE = "__metafield_empty_value__";
const PERIOD_SEPARATOR = "..";
const DEFAULT_DATE_CONFIG: DateConfig = {
  selectionMode: "single",
  precision: "date",
  displayMode: "numeric",
};

const formatDateValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateRangeValue = (value: string): DateRange | null => {
  if (!value.includes(PERIOD_SEPARATOR)) return null;
  const [fromRaw, toRaw] = value.split(PERIOD_SEPARATOR);
  if (!fromRaw || !toRaw) return null;
  const from = parseDateValue(fromRaw);
  const to = parseDateValue(toRaw);
  if (!from || !to) return null;
  return { from, to };
};

const formatMonthValue = (month: number): string => String(month).padStart(2, "0");
const formatMonthTokenValue = (token: MonthToken): string =>
  token.year ? `${token.year}-${formatMonthValue(token.month)}` : formatMonthValue(token.month);

const parseMonthValue = (value: string): MonthToken | null => {
  const compact = value.trim();
  const monthOnlyMatch = compact.match(/^(\d{2})$/);
  if (monthOnlyMatch) {
    const month = Number(monthOnlyMatch[1]);
    if (!Number.isFinite(month) || month < 1 || month > 12) return null;
    return { month };
  }

  const yearMonthMatch = compact.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
    return { month, year };
  }

  return null;
};

const splitMonthPeriod = (value: string): [string, string] | null => {
  if (value.includes(PERIOD_SEPARATOR)) {
    const [startRaw, endRaw] = value.split(PERIOD_SEPARATOR);
    if (!startRaw || !endRaw) return null;
    return [startRaw.trim(), endRaw.trim()];
  }
  if (value.includes(" - ")) {
    const [startRaw, endRaw] = value.split(" - ");
    if (!startRaw || !endRaw) return null;
    return [startRaw.trim(), endRaw.trim()];
  }
  return null;
};

const parseMonthRangeValue = (value: string): { start: MonthToken; end: MonthToken } | null => {
  const period = splitMonthPeriod(value);
  if (!period) return null;
  const [startRaw, endRaw] = period;
  const start = parseMonthValue(startRaw);
  const end = parseMonthValue(endRaw);
  if (!start || !end) return null;
  return { start, end };
};

const isMonthWithinPeriod = (month: number, startMonth: number, endMonth: number): boolean => {
  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }

  return month >= startMonth || month <= endMonth;
};

const monthLocale =
  typeof navigator !== "undefined" && navigator.language
    ? navigator.language
    : "en";

const monthName = (month: number, format: "short" | "long"): string => {
  try {
    return new Intl.DateTimeFormat(monthLocale, { month: format }).format(
      new Date(Date.UTC(2000, month - 1, 1)),
    );
  } catch {
    return String(month).padStart(2, "0");
  }
};

const formatMonthToken = (value: MonthToken, dateConfig: DateConfig): string => {
  if (dateConfig.displayMode === "localized") {
    const label = monthName(value.month, "long");
    return value.year ? `${label} ${value.year}` : label;
  }

  const numeric = String(value.month).padStart(2, "0");
  return value.year ? `${value.year}-${numeric}` : numeric;
};

const getTypeLabel = (type: string): string => {
  const isList = type.startsWith("list.");
  const baseType = isList ? type.replace("list.", "") : type;
  
  const typeLabels: Record<string, string> = {
    single_line_text_field: "Single line text",
    multi_line_text_field: "Multi-line text",
    rich_text_field: "Rich text",
    single_line_text_field_choice_list: "Select",
    single_line_text_field_email: "Email",
    number_integer: "Integer",
    number_decimal: "Decimal",
    id: "ID",
    money: "Money",
    rating: "Rating",
    weight: "Weight",
    volume: "Volume",
    dimension: "Dimension",
    file_reference: "File",
    file_reference_image: "Image",
    file_reference_video: "Video",
    article_reference: "Article",
    collection_reference: "Collection",
    company_reference: "Company",
    customer_reference: "Customer",
    metaobject_reference: "Metaobject",
    order_reference: "Order",
    page_reference: "Page",
    product_reference: "Product",
    variant_reference: "Variant",
    mixed_reference: "Mixed reference",
    link: "Link",
    url: "URL",
    date: "Date / period",
    date_time: "Date and time",
    boolean: "True or false",
    color: "Color",
    json: "JSON",
  };
  
  const baseLabel = typeLabels[baseType] || baseType;
  return isList ? `${baseLabel} (List)` : baseLabel;
};

export function MetafieldInput({ definition, value, onChange, error, organizationId }: MetafieldInputProps) {
  const isListType = definition.type.startsWith("list.");
  const baseType = isListType ? definition.type.replace("list.", "") : definition.type;
  const rawSelectOptions = (definition.options?.selectOptions || []) as SelectOption[];
  const selectOptions = rawSelectOptions
    .map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
    }))
    .filter((option) => option.label.length > 0 && option.value.length > 0);
  const dateConfig: DateConfig = {
    selectionMode: definition.options?.dateConfig?.selectionMode || DEFAULT_DATE_CONFIG.selectionMode,
    precision: definition.options?.dateConfig?.precision || DEFAULT_DATE_CONFIG.precision,
    displayMode: definition.options?.dateConfig?.displayMode || DEFAULT_DATE_CONFIG.displayMode,
  };
  
  const { data: metaobjects = [], error: metaobjectsError } = useMetaobjects(organizationId);
  if (metaobjectsError) {
    console.error(metaobjectsError);
  }
  const { data: metaobjectDefinitions = [], error: metaobjectDefinitionsError } = useMetaobjectDefinitions(organizationId);
  if (metaobjectDefinitionsError) {
    console.error(metaobjectDefinitionsError);
  }

  const [metaobjectListOpen, setMetaobjectListOpen] = useState(false);
  const [metaobjectListSearch, setMetaobjectListSearch] = useState("");
  const metaobjectListInputRef = useRef<HTMLInputElement>(null);
  const [metaobjectListFocused, setMetaobjectListFocused] = useState(false);

  const [metaobjectSingleOpen, setMetaobjectSingleOpen] = useState(false);
  const [metaobjectSingleSearch, setMetaobjectSingleSearch] = useState("");
  const metaobjectSingleInputRef = useRef<HTMLInputElement>(null);
  const [metaobjectSingleFocused, setMetaobjectSingleFocused] = useState(false);

  const [isCreatingMetaobject, setIsCreatingMetaobject] = useState(false);
  const createMetaobjectMutation = useCreateMetaobject();
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [fileDialogFieldType, setFileDialogFieldType] = useState<"file_reference" | "file_reference_image" | "file_reference_video" | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const handleChange = (newValue: unknown) => {
    onChange(newValue);
  };

  const renderInput = () => {
    if (isListType) {
      if (baseType === "metaobject_reference") {
        return renderMetaobjectListInput();
      }
      return renderListInput();
    }

    if (definition.type === "metaobject_reference") {
      return renderSingleMetaobjectInput();
    }

    return renderSingleInput(definition.type, value, handleChange, false);
  };

  const renderListInput = () => {
    const listValue = Array.isArray(value) ? value : value ? [value] : [];
    
    return (
      <div className="space-y-2">
        {listValue.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move shrink-0" />
            <div className="flex-1">
              {renderSingleInput(baseType, item, (newItem) => {
                const newList = [...listValue];
                newList[index] = newItem;
                handleChange(newList);
              }, true)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                const newList = listValue.filter((_, i) => i !== index);
                handleChange(newList.length > 0 ? newList : undefined);
              }}
              className="h-10 w-10 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newList = [...listValue, getDefaultValue(baseType)];
              handleChange(newList);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
          {listValue.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleChange(undefined)}
              className="text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderMetaobjectListInput = () => {
    const listValue = Array.isArray(value) ? value : value ? [value] : [];
    const selectedIds = new Set(listValue.map((id) => String(id)));
    const allowedMetaobjectDefinitionId = definition.metaobjectDefinitionId;
    const filteredMetaobjects = allowedMetaobjectDefinitionId
      ? metaobjects.filter((metaobject) => metaobject.definitionId === allowedMetaobjectDefinitionId)
      : metaobjects;

    const handleToggleMetaobject = (metaobjectId: string) => {
      const newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(metaobjectId)) {
        newSelectedIds.delete(metaobjectId);
      } else {
        newSelectedIds.add(metaobjectId);
      }
      handleChange(Array.from(newSelectedIds));
      setMetaobjectListSearch("");
    };

    const getDisplayName = (metaobject: typeof metaobjects[0]) => {
      const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
      const displayNameKey = metaobjectDefinition?.displayNameKey;
      return displayNameKey && metaobject.fields && metaobject.fields[displayNameKey]
        ? String(metaobject.fields[displayNameKey])
        : metaobject.id;
    };

    const filteredMetaobjectsList = filteredMetaobjects.filter((metaobject) => {
      if (!metaobjectListSearch) return true;
      const searchLower = metaobjectListSearch.toLowerCase();
      const displayName = getDisplayName(metaobject);
      const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
      const typeLabel = metaobjectDefinition?.name || "";
      return displayName.toLowerCase().includes(searchLower) || typeLabel.toLowerCase().includes(searchLower);
    });

    return (
      <div className="space-y-2">
        <div className="relative">
          <Popover 
            open={metaobjectListOpen || metaobjectListFocused} 
            onOpenChange={(open) => {
              if (metaobjectListFocused && !open) {
                return;
              }
              setMetaobjectListOpen(open);
            }}
            modal={false}
          >
            <PopoverAnchor asChild>
              <Input
                ref={metaobjectListInputRef}
                type="text"
                placeholder={`Add ${definition.name.toLowerCase()}`}
                value={metaobjectListSearch}
                onChange={(e) => {
                  setMetaobjectListSearch(e.target.value);
                  setMetaobjectListOpen(true);
                }}
                onFocus={() => {
                  setMetaobjectListFocused(true);
                  setMetaobjectListOpen(true);
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    const relatedTarget = e.relatedTarget as Node | null;
                    if (!metaobjectListInputRef.current?.contains(relatedTarget)) {
                      setMetaobjectListFocused(false);
                      setMetaobjectListOpen(false);
                    }
                  }, 200);
                }}
                className={error ? "border-destructive" : ""}
              />
            </PopoverAnchor>
            <PopoverContent 
              className="w-[400px] p-0" 
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>No metaobjects found.</CommandEmpty>
                <CommandGroup>
                  {filteredMetaobjectsList.map((metaobject) => {
                    const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
                    const displayName = getDisplayName(metaobject);
                    const typeLabel = metaobjectDefinition?.name;
                    const isSelected = selectedIds.has(metaobject.id);
                    return (
                      <CommandItem
                        key={metaobject.id}
                        value={metaobject.id}
                        onSelect={() => {
                          handleToggleMetaobject(metaobject.id);
                          metaobjectListInputRef.current?.focus();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1">
                          <div className="font-medium">{displayName}</div>
                          {typeLabel && typeLabel !== displayName && (
                            <div className="text-xs text-muted-foreground">{typeLabel}</div>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setMetaobjectListOpen(false);
                      setMetaobjectListFocused(false);
                      setIsCreatingMetaobject(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add new entry</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        </div>
        
        {listValue.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {listValue.map((metaobjectId) => {
              const metaobject = metaobjects.find((m) => m.id === String(metaobjectId));
              if (!metaobject) return null;
              const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
              const displayName = getDisplayName(metaobject);
              const typeLabel = metaobjectDefinition?.name;
              return (
                <div key={metaobject.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex-1">
                    <div className="font-medium">{displayName}</div>
                    {typeLabel && typeLabel !== displayName && (
                      <div className="text-xs text-muted-foreground">{typeLabel}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleMetaobject(metaobject.id)}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleChange(undefined)}
              className="text-muted-foreground hover:text-destructive w-full"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderSingleMetaobjectInput = () => {
    if (!organizationId) {
      return (
        <Input
          type="text"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => handleChange(e.target.value || undefined)}
          placeholder="Enter metaobject ID"
          className={error ? "border-destructive" : ""}
          disabled
        />
      );
    }
    const allowedMetaobjectDefinitionId = definition.metaobjectDefinitionId;
    const filteredMetaobjects = allowedMetaobjectDefinitionId
      ? metaobjects.filter((metaobject) => metaobject.definitionId === allowedMetaobjectDefinitionId)
      : metaobjects;

    const getDisplayName = (metaobject: typeof metaobjects[0]) => {
      const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
      const displayNameKey = metaobjectDefinition?.displayNameKey;
      return displayNameKey && metaobject.fields && metaobject.fields[displayNameKey]
        ? String(metaobject.fields[displayNameKey])
        : metaobject.id;
    };

    const selectedMetaobject = value ? metaobjects.find((m) => m.id === String(value)) : null;
    const displayValue = selectedMetaobject ? getDisplayName(selectedMetaobject) : "";

    const filteredMetaobjectsList = filteredMetaobjects.filter((metaobject) => {
      if (!metaobjectSingleSearch) return true;
      const searchLower = metaobjectSingleSearch.toLowerCase();
      const displayName = getDisplayName(metaobject);
      const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
      const typeLabel = metaobjectDefinition?.name || "";
      return displayName.toLowerCase().includes(searchLower) || typeLabel.toLowerCase().includes(searchLower);
    });

    return (
      <div className="relative">
        <Popover 
          open={metaobjectSingleOpen || metaobjectSingleFocused} 
          onOpenChange={(open) => {
            if (metaobjectSingleFocused && !open) {
              return;
            }
            setMetaobjectSingleOpen(open);
          }}
          modal={false}
        >
          <PopoverAnchor asChild>
            <Input
              ref={metaobjectSingleInputRef}
              type="text"
              placeholder="Select a metaobject"
              value={metaobjectSingleSearch || displayValue}
              onChange={(e) => {
                setMetaobjectSingleSearch(e.target.value);
                setMetaobjectSingleOpen(true);
                if (!e.target.value && selectedMetaobject) {
                  handleChange(undefined);
                }
              }}
              onFocus={() => {
                setMetaobjectSingleFocused(true);
                setMetaobjectSingleOpen(true);
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  const relatedTarget = e.relatedTarget as Node | null;
                  if (!metaobjectSingleInputRef.current?.contains(relatedTarget)) {
                    setMetaobjectSingleFocused(false);
                    setMetaobjectSingleOpen(false);
                  }
                }, 200);
              }}
              className={error ? "border-destructive" : ""}
            />
          </PopoverAnchor>
          <PopoverContent 
            className="w-[400px] p-0" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>No metaobjects found.</CommandEmpty>
                <CommandGroup>
                  {filteredMetaobjectsList.map((metaobject) => {
                  const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
                  const displayName = getDisplayName(metaobject);
                  const typeLabel = metaobjectDefinition?.name;
                  const fullLabel = typeLabel && typeLabel !== displayName 
                    ? `${displayName} (${typeLabel})`
                    : displayName;
                  const isSelected = value === metaobject.id;
                  return (
                    <CommandItem
                      key={metaobject.id}
                      value={metaobject.id}
                      onSelect={() => {
                        handleChange(metaobject.id);
                        setMetaobjectSingleSearch("");
                        metaobjectSingleInputRef.current?.focus();
                      }}
                      className="flex items-center gap-2"
                    >
                      {isSelected && <span className="text-primary">✓</span>}
                      <span className={isSelected ? "font-medium" : ""}>{fullLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setMetaobjectSingleOpen(false);
                    setMetaobjectSingleFocused(false);
                    setIsCreatingMetaobject(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add new entry</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      </div>
    );
  };

  const renderDateInput = (currentValue: unknown, onValueChange: (val: unknown) => void) => {
    const rawValue = typeof currentValue === "string" ? currentValue : "";

    if (dateConfig.precision === "date") {
      const selectedDate = parseDateValue(rawValue);
      const selectedRange = parseDateRangeValue(rawValue);
      const displayValue = dateConfig.selectionMode === "single"
        ? (selectedDate ? selectedDate.toLocaleDateString() : rawValue)
        : (selectedRange?.from && selectedRange?.to
          ? `${selectedRange.from.toLocaleDateString()} - ${selectedRange.to.toLocaleDateString()}`
          : rawValue);

      return (
        <div className="space-y-2">
          <Popover
            open={isDatePickerOpen}
            onOpenChange={setIsDatePickerOpen}
          >
            <PopoverTrigger asChild>
              <Input
                readOnly
                role="button"
                value={displayValue || ""}
                onFocus={() => setIsDatePickerOpen(true)}
                onClick={() => setIsDatePickerOpen(true)}
                placeholder={dateConfig.selectionMode === "period" ? "Select start and end dates" : "Select a date"}
                className={error ? "border-destructive cursor-pointer" : "cursor-pointer"}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {dateConfig.selectionMode === "single" ? (
                <Calendar
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={(selected) => {
                    if (!selected) {
                      onValueChange(undefined);
                      return;
                    }
                    onValueChange(formatDateValue(selected));
                    setIsDatePickerOpen(false);
                  }}
                  autoFocus
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={selectedRange || undefined}
                  onSelect={(selected) => {
                    if (!selected?.from || !selected?.to) return;
                    const start = selected.from <= selected.to ? selected.from : selected.to;
                    const end = selected.from <= selected.to ? selected.to : selected.from;
                    onValueChange(`${formatDateValue(start)}${PERIOD_SEPARATOR}${formatDateValue(end)}`);
                    setIsDatePickerOpen(false);
                  }}
                  numberOfMonths={2}
                  autoFocus
                />
              )}
            </PopoverContent>
          </Popover>
          {(currentValue != null && currentValue !== "") ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onValueChange(undefined)}
              className="text-muted-foreground hover:text-destructive"
            >
              Clear
            </Button>
          ) : null}
        </div>
      );
    }

    const selectedMonth = parseMonthValue(rawValue);
    const selectedMonthRange = parseMonthRangeValue(rawValue);
    const periodStart = selectedMonthRange?.start;
    const periodEnd = selectedMonthRange?.end;
    const triggerLabel = dateConfig.selectionMode === "single"
      ? (selectedMonth ? formatMonthToken(selectedMonth, dateConfig) : rawValue)
      : (selectedMonthRange
        ? `${formatMonthToken(selectedMonthRange.start, dateConfig)} - ${formatMonthToken(selectedMonthRange.end, dateConfig)}`
        : rawValue);

    const updateMonthRange = (nextStart: MonthToken, nextEnd: MonthToken) => {
      onValueChange(
        `${formatMonthTokenValue(nextStart)}${PERIOD_SEPARATOR}${formatMonthTokenValue(nextEnd)}`,
      );
    };

    const renderMonthCells = (panel: "single" | "start" | "end") =>
      Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        const clicked: MonthToken = { month: monthNumber };
        const clickedValue = formatMonthValue(clicked.month);

        const isSingleSelected = panel === "single"
          && !!selectedMonth
          && selectedMonth.month === clicked.month;
        const isRangeStart = panel === "start" && !!periodStart && periodStart.month === clicked.month;
        const isRangeEnd = panel === "end" && !!periodEnd && periodEnd.month === clicked.month;
        const isRangeEdge = isRangeStart || isRangeEnd;
        const isInRange = panel !== "single"
          && !!periodStart
          && !!periodEnd
          && isMonthWithinPeriod(clicked.month, periodStart.month, periodEnd.month);

        const monthState = isSingleSelected || isRangeEdge
          ? "selected"
          : isInRange
            ? "range"
            : "idle";

        return (
          <Button
            key={`${panel}-${monthNumber}`}
            type="button"
            variant="ghost"
            aria-pressed={monthState !== "idle"}
            className={[
              "h-11 justify-center rounded-md border text-base font-semibold transition-colors sm:h-10 sm:text-sm",
              monthState === "selected" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "",
              monthState === "range" ? "border-primary/20 bg-primary/10 text-foreground hover:bg-primary/15" : "",
              monthState === "idle" ? "border-border/60 bg-muted/50 text-foreground hover:bg-accent hover:text-accent-foreground" : "",
            ].join(" ").trim()}
            onClick={() => {
              if (panel === "single") {
                onValueChange(clickedValue);
                setIsDatePickerOpen(false);
                return;
              }

              if (panel === "start") {
                const nextEnd = periodEnd ?? clicked;
                updateMonthRange(clicked, nextEnd);
                return;
              }

              const nextStart = periodStart ?? clicked;
              updateMonthRange(nextStart, clicked);
            }}
          >
            {dateConfig.displayMode === "localized" ? monthName(monthNumber, "short") : String(monthNumber).padStart(2, "0")}
          </Button>
        );
      });

    return (
      <div className="space-y-2">
        <Popover
          open={isDatePickerOpen}
          onOpenChange={setIsDatePickerOpen}
        >
          <PopoverTrigger asChild>
            <Input
              readOnly
              role="button"
              value={triggerLabel || ""}
              onFocus={() => setIsDatePickerOpen(true)}
              onClick={() => setIsDatePickerOpen(true)}
              placeholder={dateConfig.selectionMode === "period" ? "Select month range" : "Select month"}
              className={error ? "border-destructive cursor-pointer" : "cursor-pointer"}
            />
          </PopoverTrigger>
          <PopoverContent
            className={dateConfig.selectionMode === "period"
              ? "w-[min(42rem,calc(100vw-2rem))] p-4 space-y-4"
              : "w-[min(26rem,calc(100vw-2rem))] p-4 space-y-4"}
            align="start"
          >
            {dateConfig.selectionMode === "period" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start month</span>
                      <span className="text-xs font-medium text-foreground">
                        {periodStart ? formatMonthToken(periodStart, dateConfig) : "Not set"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {renderMonthCells("start")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End month</span>
                      <span className="text-xs font-medium text-foreground">
                        {periodEnd ? formatMonthToken(periodEnd, dateConfig) : "Not set"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {renderMonthCells("end")}
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {selectedMonthRange ? (
                    <>
                      Selected period: <span className="font-semibold text-foreground">{formatMonthToken(selectedMonthRange.start, dateConfig)} - {formatMonthToken(selectedMonthRange.end, dateConfig)}</span>
                    </>
                  ) : (
                    "Select a start month and an end month."
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {renderMonthCells("single")}
              </div>
            )}
          </PopoverContent>
        </Popover>
        {(currentValue != null && currentValue !== "") ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onValueChange(undefined)}
            className="text-muted-foreground hover:text-destructive"
          >
            Clear
          </Button>
        ) : null}
      </div>
    );
  };

  const renderSingleInput = (type: string, currentValue: unknown, onValueChange: (val: unknown) => void, isList: boolean = false) => {
    switch (type) {
      case "single_line_text_field":
      case "single_line_text_field_email":
      case "url":
      case "link":
        return (
          <Input
            type={type === "single_line_text_field_email" ? "email" : type === "url" || type === "link" ? "url" : "text"}
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "single_line_text_field_choice_list": {
        const normalizedValue = currentValue === null || currentValue === undefined
          ? EMPTY_SELECT_VALUE
          : String(currentValue);
        const hasCurrentOption = normalizedValue !== EMPTY_SELECT_VALUE
          && selectOptions.some((option) => option.value === normalizedValue);

        return (
          <div className="space-y-2">
            <Select
              value={normalizedValue}
              onValueChange={(selectedValue) =>
                onValueChange(selectedValue === EMPTY_SELECT_VALUE ? undefined : selectedValue)
              }
            >
              <SelectTrigger className={error ? "border-destructive" : ""}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>No selection</SelectItem>
                {selectOptions.map((option, optionIndex) => (
                  <SelectItem key={`${option.value}-${optionIndex}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                {!hasCurrentOption && normalizedValue !== EMPTY_SELECT_VALUE && (
                  <SelectItem value={normalizedValue}>{`Current: ${normalizedValue}`}</SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">No select options configured for this field definition.</p>
            )}
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );
      }

      case "multi_line_text_field":
      case "rich_text_field":
        return (
          <div className="space-y-2">
            <Textarea
              value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              rows={4}
              className={error ? "border-destructive" : ""}
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );

      case "number_integer":
        return (
          <Input
            type="number"
            step="1"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseInt(val, 10));
            }}
            className={error ? "border-destructive" : ""}
          />
        );

      case "number_decimal":
      case "money":
      case "rating":
      case "weight":
      case "volume":
      case "dimension":
        return (
          <Input
            type="number"
            step="0.01"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseFloat(val));
            }}
            className={error ? "border-destructive" : ""}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={currentValue === true}
              onCheckedChange={(checked) => onValueChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {currentValue === true ? "Yes" : "No"}
            </span>
          </div>
        );

      case "date":
        return renderDateInput(currentValue, onValueChange);

      case "date_time":
        return (
          <div className="space-y-2">
            <Input
              type="datetime-local"
              value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.slice(0, 16) : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              className={error ? "border-destructive" : ""}
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );

      case "json":
        return (
          <div className="space-y-2">
            <Textarea
              value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue, null, 2)}
              onChange={(e) => {
                try {
                  const val = e.target.value.trim();
                  if (!val) {
                    onValueChange(undefined);
                    return;
                  }
                  const parsed = JSON.parse(val);
                  onValueChange(parsed);
                } catch {
                  onValueChange(e.target.value);
                }
              }}
              rows={6}
              className={`font-mono text-xs ${error ? "border-destructive" : ""}`}
              placeholder='{"key": "value"}'
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );

      case "color":
        return (
          <div className="space-y-2">
            <Input
              type="color"
              value={currentValue === null || currentValue === undefined ? "#000000" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value)}
              className={error ? "border-destructive" : ""}
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );

      case "file_reference":
      case "file_reference_image":
      case "file_reference_video": {
        if (!organizationId) {
          return (
            <Input
              type="text"
              value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              placeholder="Enter file URL"
              className={error ? "border-destructive" : ""}
              disabled
            />
          );
        }
        const fileValue = currentValue === null || currentValue === undefined ? undefined : (Array.isArray(currentValue) ? currentValue : typeof currentValue === "string" ? [currentValue] : []);
        const fileUrls = fileValue || [];
        const isImage = type === "file_reference_image";
        const isVideo = type === "file_reference_video";
        const IconComponent = isImage ? ImageIcon : isVideo ? Video : FileIcon;

        return (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFileDialogFieldType(type as "file_reference" | "file_reference_image" | "file_reference_video");
                setFileDialogOpen(true);
              }}
              className="w-full"
            >
              <IconComponent className="h-4 w-4 mr-2" />
              Select {isImage ? "image" : isVideo ? "video" : "file"}
            </Button>
            {fileUrls.length > 0 && (
              <div className="space-y-2">
                {fileUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                    {isImage && typeof url === "string" ? (
                      <img src={url} alt="" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <IconComponent className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{typeof url === "string" ? url.split("/").pop() : "File"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newUrls = fileUrls.filter((_, i) => i !== index);
                        onValueChange(newUrls.length > 0 ? (isList ? newUrls : newUrls[0]) : undefined);
                      }}
                      className="h-8 w-8 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <SelectFileDialog
              open={fileDialogOpen && fileDialogFieldType === type}
              onOpenChange={setFileDialogOpen}
              onSelect={(selected) => {
                const urls = Array.isArray(selected) ? selected : [selected];
                onValueChange(urls.length > 0 ? (isList ? urls : urls[0]) : undefined);
                setFileDialogOpen(false);
              }}
              organizationId={organizationId}
              fieldType={fileDialogFieldType || "file_reference"}
              multiple={isList}
              currentValue={fileUrls}
            />
          </div>
        );
      }

      case "id":
      case "article_reference":
      case "collection_reference":
      case "company_reference":
      case "customer_reference":
      case "order_reference":
      case "page_reference":
      case "product_reference":
      case "variant_reference":
      case "mixed_reference":
        return (
          <div className="space-y-2">
            <Input
              type="text"
              value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              placeholder="Enter ID"
              className={error ? "border-destructive" : ""}
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Input
              type="text"
              value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              className={error ? "border-destructive" : ""}
            />
            {(currentValue != null && currentValue !== "") ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange(undefined)}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        );
    }
  };

  const getDefaultValue = (type: string): unknown => {
    switch (type) {
      case "boolean":
        return false;
      case "number_integer":
      case "number_decimal":
      case "money":
      case "rating":
      case "weight":
      case "volume":
      case "dimension":
        return 0;
      case "json":
        return {};
      case "single_line_text_field_choice_list":
        return selectOptions[0]?.value || "";
      default:
        return "";
    }
  };

  const metaobjectDefinitionId = definition.metaobjectDefinitionId;
  const targetMetaobjectDefinition = metaobjectDefinitionId
    ? metaobjectDefinitions.find((def) => def.id === metaobjectDefinitionId)
    : null;

  const handleCreateMetaobject = async (fields: Record<string, unknown>) => {
    if (!organizationId || !metaobjectDefinitionId) {
      toast.error("Organization and metaobject definition are required");
      return;
    }

    try {
      const newMetaobjectId = await createMetaobjectMutation.mutateAsync({
        organizationId,
        definitionId: metaobjectDefinitionId,
        fields,
      });

      if (isListType && baseType === "metaobject_reference") {
        const listValue = Array.isArray(value) ? value : value ? [value] : [];
        handleChange([...listValue, newMetaobjectId]);
      } else if (definition.type === "metaobject_reference") {
        handleChange(newMetaobjectId);
      }

      setIsCreatingMetaobject(false);
      setMetaobjectListSearch("");
      setMetaobjectSingleSearch("");
      toast.success("Metaobject created successfully");
    } catch (error) {
      toast.error("Failed to create metaobject");
      console.error(error);
    }
  };

  return (
    <>
      <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
        <div className="space-y-1">
          <Label htmlFor={`metafield-${definition.id}`} className="underline">
            {definition.name}
          </Label>
          <p className="text-sm text-muted-foreground">{getTypeLabel(definition.type)}</p>
          {definition.description && (
            <p className="text-xs text-muted-foreground mt-1">{definition.description}</p>
          )}
        </div>
        <div className="space-y-2">
          {renderInput()}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>

      {isCreatingMetaobject && targetMetaobjectDefinition && (
        <CreateMetaobjectEntryDialog
          open={isCreatingMetaobject}
          onOpenChange={setIsCreatingMetaobject}
          metaobjectDefinition={targetMetaobjectDefinition}
          onSubmit={handleCreateMetaobject}
          isPending={createMetaobjectMutation.isPending}
          organizationId={organizationId}
        />
      )}
    </>
  );
}
