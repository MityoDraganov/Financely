import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, X, Edit, Trash2, Plus, Key, FileText, Maximize2, Scroll } from "lucide-react";
import type { TemplateData, Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { getPrimaryColor, getSecondaryColor, getAccentColor } from "@/utils/branding";
import { COMPLIANCE_SCHEMAS, type InvoiceRegion } from "@/core/entities/invoice-compliance";

type FlowType = "template" | "invoice";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateData;
  quality?: { overall: number; layout: number; text: number; table: number; font: number };
  needsReview?: boolean;
  reviewReasons?: string[];
  extractedData?: Record<string, InvoiceDataValue>;
  flowType?: FlowType;
  onAccept: (updatedData?: Record<string, InvoiceDataValue>, updatedTemplate?: TemplateData) => void;
  onEdit: (updatedTemplate?: TemplateData) => void;
}

/**
 * Format binding value for display
 */
function formatBindingValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") {
    // For objects, show a summary
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    if (keys.length <= 3) {
      return `{${keys.join(", ")}}`;
    }
    return `{${keys.slice(0, 3).join(", ")}, ...}`;
  }
  return String(value);
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
  quality,
  needsReview = false,
  reviewReasons = [],
  extractedData,
  flowType = "template",
  onAccept,
  onEdit,
}: TemplatePreviewDialogProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewMode, setPreviewMode] = useState<"fit" | "scroll">("fit");
  const [activeTab, setActiveTab] = useState<string>("preview");
  const { data: organization } = useCurrentOrganization();
  
  // State for editable extracted data
  const [editableData, setEditableData] = useState<Record<string, InvoiceDataValue>>(
    extractedData || {}
  );
  // Temporary state for keys being edited (to avoid conflicts during typing)
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  // State for editable template data
  const [editableTemplate, setEditableTemplate] = useState<TemplateData>(template);
  
  const isTemplateOnly = flowType === "template";

  const resolvePreviewSize = (data: TemplateData): { w: number; h: number } => {
    const PAGE_SIZES: Record<Exclude<TemplateData["pageSize"], undefined>, { w: number; h: number }> = {
      A4: { w: 794, h: 1123 },
      Letter: { w: 816, h: 1056 },
      Legal: { w: 816, h: 1344 },
    };
    const baseSize =
      data.pageSettings?.size === "Custom" && data.pageSettings.customSize
        ? { w: data.pageSettings.customSize.width, h: data.pageSettings.customSize.height }
        : PAGE_SIZES[(data.pageSettings?.size ?? data.pageSize) as Exclude<TemplateData["pageSize"], undefined>] ?? PAGE_SIZES.A4;
    return data.pageSettings?.orientation === "landscape"
      ? { w: baseSize.h, h: baseSize.w }
      : baseSize;
  };

  // Update editable data when extractedData prop changes
  useEffect(() => {
    if (extractedData) {
      setEditableData(extractedData);
      setEditingKeys({});
    }
  }, [extractedData]);

  // Calculate scale for fit mode
  useEffect(() => {
    if (previewMode !== "fit" || !previewContainerRef.current) {
      // Reset scale when not in fit mode
      if (previewContainerRef.current) {
        previewContainerRef.current.style.setProperty('--preview-scale', '1');
      }
      return;
    }

    const container = previewContainerRef.current;
    const size = resolvePreviewSize(editableTemplate);

    const updateScale = () => {
      if (!previewContainerRef.current) return;
      
      const container = previewContainerRef.current;
      
      // Check if container is visible (not hidden by tab switching)
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) {
        // Container is hidden, don't update
        return;
      }
      
      // Get container dimensions (accounting for padding)
      const padding = 8; // 4px padding on each side for fit mode (p-2)
      const availableWidth = Math.max(1, containerRect.width - padding);
      const availableHeight = Math.max(1, containerRect.height - padding);

      // Calculate scale to fit both width and height
      // Use the smaller ratio to ensure it fits in both dimensions
      const scaleX = availableWidth / size.w;
      const scaleY = availableHeight / size.h;
      const scale = Math.min(scaleX, scaleY); // Allow scaling up if needed to fill space

      // Apply scale via CSS variable
      container.style.setProperty('--preview-scale', String(scale));
    };

    // Use IntersectionObserver to detect when container becomes visible
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            // Container is visible, calculate scale
            requestAnimationFrame(() => {
              requestAnimationFrame(updateScale); // Double RAF to ensure layout is complete
            });
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 1.0], // Trigger at various visibility levels
      }
    );

    intersectionObserver.observe(container);

    // Update on resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const container = previewContainerRef.current;
        if (container && activeTab === "preview") {
          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            updateScale();
          }
        }
      });
    });
    resizeObserver.observe(container);

    // Also listen to window resize as a fallback
    window.addEventListener('resize', updateScale);

    // Force update when tab becomes active - use a more aggressive retry
    const forceUpdateWhenVisible = () => {
      if (activeTab !== "preview") return;
      
      let attempts = 0;
      const tryUpdate = () => {
        attempts++;
        const container = previewContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          updateScale();
        } else if (attempts < 20) {
          // Keep trying for up to 1 second (20 * 50ms)
          setTimeout(tryUpdate, 50);
        }
      };
      
      // Start with multiple RAFs to ensure layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tryUpdate();
          });
        });
      });
    };

    forceUpdateWhenVisible();

    return () => {
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [previewMode, editableTemplate.pageSize, editableTemplate.pageSettings, editableData, activeTab]);

  // Force scale recalculation when switching back to preview tab
  useEffect(() => {
    if (activeTab !== "preview" || previewMode !== "fit" || !previewContainerRef.current) return;

    // Wait for tab content to be fully visible
    const timeoutId = setTimeout(() => {
      const container = previewContainerRef.current;
      if (!container) return;

      const size = resolvePreviewSize(editableTemplate);

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const padding = 8;
        const availableWidth = Math.max(1, rect.width - padding);
        const availableHeight = Math.max(1, rect.height - padding);
        const scaleX = availableWidth / size.w;
        const scaleY = availableHeight / size.h;
        const scale = Math.min(scaleX, scaleY);
        container.style.setProperty('--preview-scale', String(scale));
      }
    }, 150); // Slightly longer delay to ensure tab animation completes

    return () => clearTimeout(timeoutId);
  }, [activeTab, previewMode, editableTemplate.pageSize, editableTemplate.pageSettings]);

  // Update editable template when template prop changes, using organization colors as defaults
  useEffect(() => {
    const orgPrimary = getPrimaryColor(organization);
    const orgSecondary = getSecondaryColor(organization);
    const orgAccent = getAccentColor(organization);
    
    // Default colors that should be replaced with organization colors
    const defaultColors = {
      primary: "#111827",
      secondary: "#6b7280",
      accent: "#2563eb",
    };
    
    const updatedTemplate = { ...template };
    
    // Check if template has brand colors
    if (updatedTemplate.brand?.colors) {
      const currentColors = updatedTemplate.brand.colors;
      // If colors match defaults, replace with organization colors
      const isDefaultPrimary = currentColors.primary === defaultColors.primary;
      const isDefaultSecondary = currentColors.secondary === defaultColors.secondary;
      const isDefaultAccent = currentColors.accent === defaultColors.accent;
      
      if (isDefaultPrimary || isDefaultSecondary || isDefaultAccent) {
        updatedTemplate.brand = {
          ...updatedTemplate.brand,
          colors: {
            primary: isDefaultPrimary ? orgPrimary : currentColors.primary,
            secondary: isDefaultSecondary ? orgSecondary : currentColors.secondary,
            accent: isDefaultAccent ? orgAccent : currentColors.accent,
          }
        };
      }
      setEditableTemplate(updatedTemplate);
    } else if (updatedTemplate.brand) {
      // Template has brand but no colors, add organization colors
      updatedTemplate.brand = {
        ...updatedTemplate.brand,
        colors: {
          primary: orgPrimary,
          secondary: orgSecondary,
          accent: orgAccent,
        }
      };
      setEditableTemplate(updatedTemplate);
    } else {
      // No brand at all, create brand with organization colors
      updatedTemplate.brand = {
        fonts: template.brand?.fonts || ["Inter"],
        colors: {
          primary: orgPrimary,
          secondary: orgSecondary,
          accent: orgAccent,
        },
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }
      };
      setEditableTemplate(updatedTemplate);
    }
  }, [template, organization]);

  // Helper to set nested value in object by path (e.g., "billedTo.name")
  const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const parts = path.split(".");
    const newObj = { ...obj };
    let current: Record<string, unknown> = newObj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return newObj;
  };

  // Helper to get nested value from object by path
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === "object" && !Array.isArray(current) && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  };

  // Handle field change (supports nested paths)
  const handleFieldChange = (field: string, value: unknown) => {
    if (field.includes(".")) {
      const updated = setNestedValue(editableData, field, value) as Record<string, InvoiceDataValue>;
      setEditableData(updated);
    } else {
      setEditableData((prev) => ({
        ...prev,
        [field]: value as InvoiceDataValue,
      }));
    }
  };

  // Format value for display
  const formatValueForDisplay = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number") return val.toLocaleString();
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (Array.isArray(val)) return `Array(${val.length})`;
    if (typeof val === "object") {
      const keys = Object.keys(val);
      return keys.length > 0 ? `{${keys.join(", ")}}` : "{}";
    }
    return String(val);
  };

  // Recursive render function for fields
  const renderField = (
    key: string,
    value: unknown,
    path = ""
  ): React.ReactNode => {
    const fullPath = path ? `${path}.${key}` : key;

    // Handle null/undefined
    if (value === null || value === undefined) {
      const currentValue = fullPath ? getNestedValue(editableData, fullPath) : editableData[key];
      if (currentValue === undefined || currentValue === null) {
        if (!path) return null;
        value = "";
      } else {
        value = currentValue;
      }
    }

    // Handle nested objects
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedObj = fullPath ? getNestedValue(editableData, fullPath) as Record<string, unknown> : editableData[key] as Record<string, unknown>;
      
      if (!nestedObj || typeof nestedObj !== "object" || Array.isArray(nestedObj)) {
        return null;
      }

      const editingKey = editingKeys[fullPath] ?? key;
      const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();
      const isDuplicate = editingKey !== key && (fullPath ? getNestedValue(editableData, fullPath.replace(new RegExp(`\\.${key}$`), `.${editingKey}`)) !== undefined : editableData[editingKey] !== undefined);

      return (
        <div key={fullPath} className="space-y-3">
          <div className="flex items-center gap-1.5 px-1">
            <Key className="h-3 w-3 text-muted-foreground shrink-0" />
            <Label
              htmlFor={fullPath}
              className="text-xs text-muted-foreground font-mono"
            >
              {fullPath}
            </Label>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
            <Input
              value={formattedEditingKey}
              onChange={(e) => {
                const rawKey = e.target.value
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");
                
                setEditingKeys((prev) => ({
                  ...prev,
                  [fullPath]: rawKey,
                }));
              }}
              onBlur={(e) => {
                const formattedValue = e.target.value.trim();
                if (!formattedValue) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                  return;
                }

                const newKey = formattedValue
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");

                if (newKey === key) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                  return;
                }

                // Handle key renaming for nested objects
                if (path) {
                  const parentObj = getNestedValue(editableData, path) as Record<string, unknown>;
                  if (parentObj && typeof parentObj === "object") {
                    const value = parentObj[key];
                    const updated = { ...parentObj };
                    delete updated[key];
                    updated[newKey] = value;
                    handleFieldChange(path, updated);
                    
                    setEditingKeys((prev) => {
                      const next = { ...prev };
                      delete next[fullPath];
                      return next;
                    });
                  }
                } else {
                  const value = editableData[key];
                  const updated = { ...editableData };
                  delete updated[key];
                  updated[newKey] = value;
                  setEditableData(updated);
                  
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                }
              }}
              className={cn("text-sm font-medium capitalize bg-background flex-1", isDuplicate && "border-destructive")}
              placeholder="Object Key"
              title={isDuplicate ? "This key already exists" : "Edit object key name"}
            />
            {path && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const parentPath = path;
                  const parentObj = getNestedValue(editableData, parentPath) as Record<string, unknown>;
                  if (parentObj && typeof parentObj === "object") {
                    const updated = { ...parentObj };
                    delete updated[key];
                    handleFieldChange(parentPath, updated);
                  }
                }}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="pl-6 space-y-2 ml-4 border-l-2 border-primary/20">
            {Object.entries(nestedObj).map(([subKey, subValue]) => {
              const subFullPath = `${fullPath}.${subKey}`;
              const currentSubValue = getNestedValue(editableData, subFullPath) ?? subValue;
              return renderField(subKey, currentSubValue, fullPath);
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newKey = `newField_${Date.now()}`;
                const parentObj = getNestedValue(editableData, fullPath) as Record<string, unknown>;
                if (parentObj && typeof parentObj === "object") {
                  const updated = { ...parentObj, [newKey]: "" };
                  handleFieldChange(fullPath, updated);
                }
              }}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-2" />
              Add Field
            </Button>
          </div>
        </div>
      );
    }

    // Handle arrays
    if (Array.isArray(value)) {
      const currentArray = fullPath ? getNestedValue(editableData, fullPath) as unknown[] : editableData[key] as unknown[];
      const arrayValue = (Array.isArray(currentArray) ? currentArray : value);

      const editingKey = editingKeys[fullPath] ?? key;
      const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();

      return (
        <div key={fullPath} className="space-y-3">
          <div className="flex items-center gap-1.5 px-1">
            <Key className="h-3 w-3 text-muted-foreground shrink-0" />
            <Label
              htmlFor={fullPath}
              className="text-xs text-muted-foreground font-mono"
            >
              {fullPath}
            </Label>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
            <Input
              value={formattedEditingKey}
              onChange={(e) => {
                const rawKey = e.target.value
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");
                
                setEditingKeys((prev) => ({
                  ...prev,
                  [fullPath]: rawKey,
                }));
              }}
              onBlur={(e) => {
                const formattedValue = e.target.value.trim();
                if (!formattedValue) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                  return;
                }

                const newKey = formattedValue
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");

                if (newKey === key) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                }
              }}
              className="text-sm font-medium capitalize bg-background flex-1"
              placeholder="Array Key"
              title="Edit array key name"
            />
            {path && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const parentPath = path;
                  const parentObj = getNestedValue(editableData, parentPath) as Record<string, unknown>;
                  if (parentObj && typeof parentObj === "object") {
                    const updated = { ...parentObj };
                    delete updated[key];
                    handleFieldChange(parentPath, updated);
                  }
                }}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2 pl-6 ml-4 border-l-2 border-primary/20">
            {arrayValue.map((item, index) => {
              const currentItem = fullPath 
                ? (getNestedValue(editableData, `${fullPath}[${index}]`) ?? item)
                : item;

              return (
                <div key={index} className="border rounded-md p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground font-mono">
                      {fullPath}[{index}]
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updated = [...arrayValue];
                        updated.splice(index, 1);
                        handleFieldChange(fullPath, updated);
                      }}
                      className="shrink-0 h-6 w-6"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {typeof currentItem === "object" && currentItem !== null && !Array.isArray(currentItem) ? (
                    <div className="space-y-2">
                      {Object.entries(currentItem as Record<string, unknown>).map(
                        ([itemKey, itemValue]) =>
                          renderField(
                            itemKey,
                            itemValue,
                            `${fullPath}[${index}]`
                          )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const itemObj = currentItem as Record<string, unknown>;
                          const newKey = `newField_${Date.now()}`;
                          const updatedItem = { ...itemObj, [newKey]: "" };
                          const updated = [...arrayValue];
                          updated[index] = updatedItem;
                          handleFieldChange(fullPath, updated);
                        }}
                        className="w-full"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Add Field
                      </Button>
                    </div>
                  ) : Array.isArray(currentItem) ? (
                    renderField(`item_${index}`, currentItem, `${fullPath}[${index}]`)
                  ) : (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground min-w-[80px]">
                        Item {index + 1}:
                      </Label>
                      <Input
                        value={String(currentItem ?? "")}
                        onChange={(e) => {
                          if (isTemplateOnly) return;
                          const updated = [...arrayValue];
                          updated[index] = e.target.value;
                          handleFieldChange(fullPath, updated);
                        }}
                        disabled={isTemplateOnly}
                        readOnly={isTemplateOnly}
                        className={cn("flex-1", isTemplateOnly && "cursor-not-allowed opacity-60")}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = [...arrayValue, {}];
                handleFieldChange(fullPath, updated);
              }}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      );
    }

    // Simple values
    const currentValue = fullPath ? getNestedValue(editableData, fullPath) : editableData[key];
    
    const isNested = !!path;
    const editingKey = isNested ? (editingKeys[fullPath] ?? key) : key;
    const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();
    const isDuplicate = isNested && editingKey !== key && (() => {
      if (!path) return false;
      const parentPath = path;
      const parentObj = getNestedValue(editableData, parentPath) as Record<string, unknown>;
      if (!parentObj || typeof parentObj !== "object") return false;
      return editingKey !== key && editingKey in parentObj;
    })();

    const displayFormattedValue = formatValueForDisplay(currentValue ?? value);

    return (
      <div key={fullPath} className="group space-y-1">
        <div className="flex items-center gap-1.5 px-1">
          <Key className="h-3 w-3 text-muted-foreground shrink-0" />
          <Label
            htmlFor={fullPath}
            className="text-xs text-muted-foreground font-mono"
          >
            {fullPath}
          </Label>
        </div>
        
        <div className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
          <div className="flex-1 min-w-0">
            <Input
              value={formattedEditingKey}
              onChange={(e) => {
                const rawKey = e.target.value
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");
                
                setEditingKeys((prev) => ({
                  ...prev,
                  [fullPath]: rawKey,
                }));
              }}
              onBlur={(e) => {
                const formattedValue = e.target.value.trim();
                if (!formattedValue) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                  return;
                }

                const newKey = formattedValue
                  .split(" ")
                  .map((word, index) => 
                    index === 0 
                      ? word.toLowerCase() 
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join("");

                if (newKey === key) {
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                  return;
                }

                if (path) {
                  const parentPath = path;
                  const parentObj = getNestedValue(editableData, parentPath) as Record<string, unknown>;
                  if (parentObj && typeof parentObj === "object") {
                    const value = parentObj[key];
                    const updated = { ...parentObj };
                    delete updated[key];
                    updated[newKey] = value;
                    handleFieldChange(parentPath, updated);
                    
                    setEditingKeys((prev) => {
                      const next = { ...prev };
                      delete next[fullPath];
                      return next;
                    });
                  }
                } else {
                  const value = editableData[key];
                  const updated = { ...editableData };
                  delete updated[key];
                  updated[newKey] = value;
                  setEditableData(updated);
                  
                  setEditingKeys((prev) => {
                    const next = { ...prev };
                    delete next[fullPath];
                    return next;
                  });
                }
              }}
              className={cn(
                "text-sm font-medium capitalize bg-background",
                isDuplicate && "border-destructive"
              )}
              placeholder="Field name"
              title={isDuplicate ? "This key already exists" : "Edit field name"}
            />
          </div>
          
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              id={fullPath}
              value={displayFormattedValue}
              onChange={(e) => {
                if (isTemplateOnly) return;
                
                let typedValue: unknown = e.target.value;
                if (typeof currentValue === "number") {
                  typedValue = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                } else if (typeof currentValue === "boolean") {
                  typedValue = e.target.value.toLowerCase() === "yes" || e.target.value === "true";
                }
                handleFieldChange(fullPath, typedValue);
              }}
              disabled={isTemplateOnly}
              readOnly={isTemplateOnly}
              className={cn(
                "flex-1 min-w-0 bg-background",
                isTemplateOnly && "cursor-not-allowed opacity-60"
              )}
              placeholder={isTemplateOnly 
                ? "Value will be set when creating invoice" 
                : `Enter ${key.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`
              }
              title={isTemplateOnly 
                ? "Template field - value will be set when creating invoice from this template" 
                : "Edit field value (formatted as it will appear in template)"
              }
            />
          </div>
          
          {isNested && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (path) {
                  const parentPath = path;
                  const parentObj = getNestedValue(editableData, parentPath) as Record<string, unknown>;
                  if (parentObj && typeof parentObj === "object") {
                    const updated = { ...parentObj };
                    delete updated[key];
                    handleFieldChange(parentPath, updated);
                  }
                }
              }}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Handle accept with updated data and template
  const handleAccept = () => {
    if (needsReview) {
      return;
    }
    onAccept(editableData, editableTemplate);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none! lg:max-w-[80dvw]! w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-4 pt-4 pb-3 shrink-0 border-b">
          <DialogTitle className="text-base">Template Preview</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Review the generated template with your extracted data. You can accept it or edit it manually.
          </DialogDescription>
          {quality && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Overall {(quality.overall * 100).toFixed(0)}%</Badge>
              <Badge variant="outline">Layout {(quality.layout * 100).toFixed(0)}%</Badge>
              <Badge variant="outline">Text {(quality.text * 100).toFixed(0)}%</Badge>
              <Badge variant="outline">Table {(quality.table * 100).toFixed(0)}%</Badge>
              <Badge variant="outline">Font {(quality.font * 100).toFixed(0)}%</Badge>
            </div>
          )}
          {needsReview && (
            <Alert className="mt-3 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
              <AlertDescription className="text-xs">
                This template is flagged for manual review and cannot be accepted directly.
                {reviewReasons.length > 0 ? ` Reasons: ${reviewReasons.join("; ")}` : ""}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 pt-2 pb-2 shrink-0">
            <TabsList className="w-full rounded-sm h-9">
              <TabsTrigger value="preview" className="rounded text-sm">Invoice Preview</TabsTrigger>
              <TabsTrigger value="data" className="rounded text-sm">Data Editor</TabsTrigger>
              <TabsTrigger value="details" className="rounded text-sm">Template Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 pb-4">
            {editableData && Object.keys(editableData).length > 0 ? (
              <>
                {/* Preview Mode Toggle - Compact floating style */}
                <div className="flex items-center justify-end gap-2 mb-2 shrink-0">
                  <ToggleGroup
                    type="single"
                    value={previewMode}
                    onValueChange={(value) => {
                      if (value) setPreviewMode(value as "fit" | "scroll");
                    }}
                    variant="outline"
                    className="h-8"
                  >
                    <ToggleGroupItem value="fit" aria-label="Fit to screen" className="text-xs px-3">
                      <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                      Fit
                    </ToggleGroupItem>
                    <ToggleGroupItem value="scroll" aria-label="Larger width with scroll" className="text-xs px-3">
                      <Scroll className="h-3.5 w-3.5 mr-1.5" />
                      Scroll
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Preview Container */}
                <div 
                  ref={previewContainerRef}
                  className={cn(
                    "flex-1 bg-muted/30 rounded-md border overflow-hidden",
                    previewMode === "fit" 
                      ? "flex items-center justify-center p-2" 
                      : "p-4 overflow-y-auto"
                  )}
                  style={{
                    minWidth: 0,
                    minHeight: 0,
                    position: 'relative',
                  }}
                >
                  {/* Wrapper for fit mode - scales down to fit */}
                  {previewMode === "fit" ? (
                    <div 
                      className="flex items-center justify-center w-full h-full"
                      style={{
                        overflow: 'hidden',
                        position: 'relative',
                        minWidth: 0,
                        minHeight: 0,
                      }}
                    >
                      {/* Wrapper that scales the preview to fit */}
                      <div
                        style={{
                          transform: 'scale(var(--preview-scale, 1))',
                          transformOrigin: 'center center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          // Don't constrain width/height - let preview render at natural size
                          width: 'auto',
                          height: 'auto',
                        }}
                      >
                        <TemplatePreview
                          template={{
                            ...editableTemplate,
                            id: "preview-template",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          } as Template}
                          context={editableData}
                          zoom={1}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Scroll mode - larger width with vertical scroll */
                    <div 
                      className="flex items-start justify-center w-full min-h-full"
                      style={{
                        minWidth: '800px', // Larger width for scroll mode
                        maxWidth: '1200px',
                        margin: '0 auto',
                      }}
                    >
                      <TemplatePreview
                        template={{
                          ...editableTemplate,
                          id: "preview-template",
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        } as Template}
                        context={editableData}
                        zoom={1}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground text-center">
                    No extracted data available for preview
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="data" className="flex-1 overflow-y-auto mt-4 px-6 pb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {flowType === "template" ? "Template Bindings" : "Invoice Data"}
                </CardTitle>
                <CardDescription>
                  {flowType === "template"
                    ? "Edit the binding keys. Values are read-only and come from the extracted data."
                    : "Edit both keys and values for the invoice data."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isTemplateOnly && (
                  <div className="rounded-md bg-muted/50 border border-border p-3 text-sm text-muted-foreground mb-4">
                    <strong className="text-foreground">Template Mode:</strong> Field names are editable. Values shown are examples and will be set when creating invoices from this template.
                  </div>
                )}
                <div className="space-y-4">
                  {Object.entries(editableData).map(([key]) => {
                    const currentValue = editableData[key];
                    return (
                      <div key={key}>
                        {renderField(key, currentValue, "")}
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newKey = `newField_${Date.now()}`;
                    setEditableData((prev) => ({
                      ...prev,
                      [newKey]: "",
                    }));
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isTemplateOnly ? "Add Field" : "Add Key-Value Pair"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 space-y-4 px-6 pb-6">
            {/* Template Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Information</CardTitle>
                <CardDescription>Edit basic template properties</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={editableTemplate.name}
                    onChange={(e) => setEditableTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-description">Description</Label>
                  <Textarea
                    id="template-description"
                    value={editableTemplate.description || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditableTemplate(prev => ({ ...prev, description: e.target.value || undefined }))}
                    placeholder="Enter template description (optional)"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-page-size">Page Size</Label>
                  <Select
                    value={editableTemplate.pageSize}
                    onValueChange={(value: "A4" | "Letter") => setEditableTemplate(prev => ({ ...prev, pageSize: value }))}
                  >
                    <SelectTrigger id="template-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editableTemplate.elements.length > 0 && (
                  <div className="flex items-center gap-4 text-sm pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground">Elements: </span>
                      <Badge variant="outline">{editableTemplate.elements.length}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <Badge variant={editableTemplate.status === "published" ? "default" : "secondary"}>
                        {editableTemplate.status}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compliance Settings</CardTitle>
                <CardDescription>Configure compliance requirements for invoice templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="compliance-region">Region</Label>
                  <Select
                    value={editableTemplate.compliance?.region || "none"}
                    onValueChange={(value: "US" | "EU" | "CA" | "AU" | "UK" | "none") => {
                      const newRegion = value === "none" ? undefined : value;
                      // When region changes, pre-select all required fields for that region
                      const requiredFields = newRegion && COMPLIANCE_SCHEMAS[newRegion as InvoiceRegion]
                        ? COMPLIANCE_SCHEMAS[newRegion as InvoiceRegion].requiredFields.map(field => field.binding)
                        : [];
                      setEditableTemplate(prev => ({
                        ...prev,
                        compliance: {
                          ...prev.compliance,
                          region: newRegion,
                          requiredFields,
                          autoFooter: prev.compliance?.autoFooter ?? true,
                          complianceValidated: false,
                        }
                      }));
                    }}
                  >
                    <SelectTrigger id="compliance-region">
                      <SelectValue placeholder="Select region (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="EU">European Union</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Required Fields</Label>
                  {editableTemplate.compliance?.region && COMPLIANCE_SCHEMAS[editableTemplate.compliance.region as InvoiceRegion] ? (
                    <div className="space-y-3 border rounded-md p-4 bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-3">
                        Select which fields are required for {editableTemplate.compliance.region} compliance:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {COMPLIANCE_SCHEMAS[editableTemplate.compliance.region as InvoiceRegion].requiredFields.map((field) => {
                          const isChecked = (editableTemplate.compliance?.requiredFields || []).includes(field.binding);
                          return (
                            <div key={field.binding} className="flex items-start space-x-2">
                              <Checkbox
                                id={`required-field-${field.binding}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const currentFields = editableTemplate.compliance?.requiredFields || [];
                                  const newFields = checked
                                    ? [...currentFields, field.binding]
                                    : currentFields.filter((f) => f !== field.binding);
                                  setEditableTemplate(prev => ({
                                    ...prev,
                                    compliance: {
                                      ...prev.compliance,
                                      requiredFields: newFields,
                                      region: prev.compliance?.region,
                                      autoFooter: prev.compliance?.autoFooter ?? true,
                                      complianceValidated: prev.compliance?.complianceValidated ?? false,
                                    }
                                  }));
                                }}
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor={`required-field-${field.binding}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {field.label}
                                </Label>
                                {field.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                                )}
                                <p className="text-xs font-mono text-muted-foreground mt-0.5">{field.binding}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 bg-muted/30">
                      <p className="text-sm text-muted-foreground">
                        Select a region above to see available required fields for compliance.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="compliance-auto-footer"
                    checked={editableTemplate.compliance?.autoFooter ?? true}
                    onCheckedChange={(checked: boolean) => {
                      setEditableTemplate(prev => ({
                        ...prev,
                        compliance: {
                          ...prev.compliance,
                          autoFooter: checked === true,
                          region: prev.compliance?.region,
                          requiredFields: prev.compliance?.requiredFields || [],
                          complianceValidated: prev.compliance?.complianceValidated ?? false,
                        }
                      }));
                    }}
                  />
                  <Label htmlFor="compliance-auto-footer" className="cursor-pointer">
                    Auto-generate compliance footer
                  </Label>
                </div>

                {!editableTemplate.compliance?.autoFooter && (
                  <div className="space-y-2">
                    <Label htmlFor="compliance-custom-footer">Custom Footer Text</Label>
                    <Textarea
                      id="compliance-custom-footer"
                      value={editableTemplate.compliance?.customFooter || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        setEditableTemplate(prev => ({
                          ...prev,
                          compliance: {
                            ...prev.compliance,
                            customFooter: e.target.value || undefined,
                            region: prev.compliance?.region,
                            requiredFields: prev.compliance?.requiredFields || [],
                            autoFooter: prev.compliance?.autoFooter ?? true,
                            complianceValidated: prev.compliance?.complianceValidated ?? false,
                          }
                        }));
                      }}
                      placeholder="Enter custom footer text (overrides auto-generated footer)"
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Brand Settings */}
            {editableTemplate.brand && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Brand Settings</CardTitle>
                  <CardDescription>Customize brand colors and margins</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Brand Colors</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="color-primary" className="text-xs">Primary</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="color-primary"
                              value={editableTemplate.brand.colors.primary}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      primary: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="h-10 w-16 rounded border cursor-pointer"
                            />
                            <Input
                              value={editableTemplate.brand.colors.primary}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      primary: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="flex-1 font-mono text-xs"
                              placeholder="#111827"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color-secondary" className="text-xs">Secondary</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="color-secondary"
                              value={editableTemplate.brand.colors.secondary}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      secondary: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="h-10 w-16 rounded border cursor-pointer"
                            />
                            <Input
                              value={editableTemplate.brand.colors.secondary}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      secondary: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="flex-1 font-mono text-xs"
                              placeholder="#6b7280"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color-accent" className="text-xs">Accent</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="color-accent"
                              value={editableTemplate.brand.colors.accent}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      accent: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="h-10 w-16 rounded border cursor-pointer"
                            />
                            <Input
                              value={editableTemplate.brand.colors.accent}
                              onChange={(e) => {
                                setEditableTemplate(prev => ({
                                  ...prev,
                                  brand: {
                                    ...prev.brand,
                                    colors: {
                                      ...prev.brand.colors,
                                      accent: e.target.value,
                                    }
                                  }
                                }));
                              }}
                              className="flex-1 font-mono text-xs"
                              placeholder="#2563eb"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <Label className="mb-2 block">Page Margins (px)</Label>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="margin-top" className="text-xs">Top</Label>
                          <Input
                            id="margin-top"
                            type="number"
                            min="0"
                            value={editableTemplate.brand.margins.top}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setEditableTemplate(prev => ({
                                ...prev,
                                brand: {
                                  ...prev.brand,
                                  margins: {
                                    ...prev.brand.margins,
                                    top: value,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="margin-right" className="text-xs">Right</Label>
                          <Input
                            id="margin-right"
                            type="number"
                            min="0"
                            value={editableTemplate.brand.margins.right}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setEditableTemplate(prev => ({
                                ...prev,
                                brand: {
                                  ...prev.brand,
                                  margins: {
                                    ...prev.brand.margins,
                                    right: value,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="margin-bottom" className="text-xs">Bottom</Label>
                          <Input
                            id="margin-bottom"
                            type="number"
                            min="0"
                            value={editableTemplate.brand.margins.bottom}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setEditableTemplate(prev => ({
                                ...prev,
                                brand: {
                                  ...prev.brand,
                                  margins: {
                                    ...prev.brand.margins,
                                    bottom: value,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="margin-left" className="text-xs">Left</Label>
                          <Input
                            id="margin-left"
                            type="number"
                            min="0"
                            value={editableTemplate.brand.margins.left}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setEditableTemplate(prev => ({
                                ...prev,
                                brand: {
                                  ...prev.brand,
                                  margins: {
                                    ...prev.brand.margins,
                                    left: value,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <Label className="mb-2 block">Fonts</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{editableTemplate.brand.fonts.join(", ")}</Badge>
                        <span className="text-xs text-muted-foreground">
                          (Font editing available in designer)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Elements Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Elements</CardTitle>
                <CardDescription>View all elements and their bindings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs max-h-60 overflow-y-auto">
                  {editableTemplate.elements.map((el, idx) => {
                    let bindingDisplay = "";
                    const binding = (el.type === "text" || el.type === "image" || el.type === "input" || el.type === "currency") 
                      ? (el as { binding?: string }).binding 
                      : undefined;
                    if (binding) {
                      bindingDisplay = binding;
                      if (editableData) {
                        const value = getBindingValue(editableData, binding);
                        if (value !== null && value !== undefined) {
                          bindingDisplay += ` = ${formatBindingValue(value)}`;
                        }
                      }
                    }
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {el.type}
                        </Badge>
                        {bindingDisplay && (
                          <span className="text-muted-foreground truncate text-xs" title={bindingDisplay}>
                            {bindingDisplay}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="px-4 py-3 border-t shrink-0">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button variant="outline" onClick={() => onEdit(editableTemplate)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit in Designer
            </Button>
            <Button onClick={handleAccept} disabled={needsReview} title={needsReview ? "Manual review required before acceptance" : undefined}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get value from extracted data by binding path
 */
function getBindingValue(data: Record<string, InvoiceDataValue>, path: string): unknown {
  if (!path) return null;
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current) && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current;
}
