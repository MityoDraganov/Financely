import { useState, useRef } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ProductMetafieldDefinition } from "@/core";
import { useMetaobjects, useMetaobjectDefinitions, useCreateMetaobject } from "@/hooks/repository-hooks/use-metaobjects";
import { toast } from "sonner";
import { CreateMetaobjectEntryDialog } from "./create-metaobject-entry-dialog";

interface MetafieldInputProps {
  definition: ProductMetafieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  organizationId?: string;
}

const getTypeLabel = (type: string): string => {
  const isList = type.startsWith("list.");
  const baseType = isList ? type.replace("list.", "") : type;
  
  const typeLabels: Record<string, string> = {
    single_line_text_field: "Single line text",
    multi_line_text_field: "Multi-line text",
    rich_text_field: "Rich text",
    single_line_text_field_choice_list: "Choice list",
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
    date: "Date",
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
  
  const { data: metaobjects = [] } = useMetaobjects(organizationId);
  const { data: metaobjectDefinitions = [] } = useMetaobjectDefinitions(organizationId);

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

    return renderSingleInput(definition.type, value, handleChange);
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
              })}
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

  const renderSingleInput = (type: string, currentValue: unknown, onValueChange: (val: unknown) => void) => {
    switch (type) {
      case "single_line_text_field":
      case "single_line_text_field_email":
      case "single_line_text_field_choice_list":
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
        return (
          <div className="space-y-2">
            <Input
              type="date"
              value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.split("T")[0] : String(currentValue)}
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

      case "id":
      case "file_reference":
      case "file_reference_image":
      case "file_reference_video":
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
        />
      )}
    </>
  );
}

