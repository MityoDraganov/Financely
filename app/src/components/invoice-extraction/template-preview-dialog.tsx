import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, X, Edit, Trash2, Plus } from "lucide-react";
import type { TemplateData, Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRef, useEffect, useState } from "react";

type FlowType = "template" | "invoice";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateData;
  extractedData?: Record<string, InvoiceDataValue>;
  flowType?: FlowType;
  onAccept: (updatedData?: Record<string, InvoiceDataValue>) => void;
  onEdit: () => void;
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
  extractedData,
  flowType = "template",
  onAccept,
  onEdit,
}: TemplatePreviewDialogProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);
  
  // State for editable extracted data
  const [editableData, setEditableData] = useState<Record<string, InvoiceDataValue>>(
    extractedData || {}
  );
  // Temporary state for keys being edited (to avoid conflicts during typing)
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});

  // Update editable data when extractedData prop changes
  useEffect(() => {
    if (extractedData) {
      setEditableData(extractedData);
      setEditingKeys({});
    }
  }, [extractedData]);

  // Handle key change (on blur to commit the change)
  const handleKeyBlur = (oldKey: string, newKey: string) => {
    // Remove from editing state
    setEditingKeys((prev) => {
      const next = { ...prev };
      delete next[oldKey];
      return next;
    });

    // Validate and apply change
    if (newKey === oldKey || !newKey.trim()) return;
    
    // Check for duplicate keys
    if (editableData[newKey] !== undefined && newKey !== oldKey) {
      // Key already exists, don't change
      return;
    }
    
    const newData = { ...editableData };
    const value = newData[oldKey];
    delete newData[oldKey];
    newData[newKey] = value;
    setEditableData(newData);
  };

  // Handle key input change (temporary state while typing)
  const handleKeyInputChange = (oldKey: string, newKey: string) => {
    setEditingKeys((prev) => ({
      ...prev,
      [oldKey]: newKey,
    }));
  };

  // Handle value change (only for invoice flow)
  const handleValueChange = (key: string, value: string) => {
    if (flowType !== "invoice") return;
    
    setEditableData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle remove key-value pair
  const handleRemove = (key: string) => {
    const newData = { ...editableData };
    delete newData[key];
    setEditableData(newData);
  };

  // Handle add new key-value pair
  const handleAdd = () => {
    const newKey = `newField_${Date.now()}`;
    setEditableData((prev) => ({
      ...prev,
      [newKey]: "",
    }));
  };

  // Handle accept with updated data
  const handleAccept = () => {
    onAccept(editableData);
  };

  // Calculate zoom to fit both width and height with proper overflow handling
  useEffect(() => {
    if (!template || !previewContainerRef.current || !editableData) return;

    const PAGE_SIZES: Record<TemplateData["pageSize"], { w: number; h: number }> = {
      A4: { w: 794, h: 1123 },
      Letter: { w: 816, h: 1056 },
    };
    const size = PAGE_SIZES[template.pageSize] ?? PAGE_SIZES.A4;

    const updateZoom = () => {
      if (!previewContainerRef.current) return;
      const container = previewContainerRef.current;
      
      // Get actual container dimensions (accounting for any borders)
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Account for padding: p-6 = 24px on all sides
      const paddingX = 48; // 24px * 2 (left + right)
      const paddingY = 48; // 24px * 2 (top + bottom)
      
      // Calculate available space for the scaled canvas
      const availableWidth = Math.max(1, containerWidth - paddingX);
      const availableHeight = Math.max(1, containerHeight - paddingY);
      
      // Calculate zoom ratios for both dimensions
      const widthZoom = availableWidth / size.w;
      const heightZoom = availableHeight / size.h;
      
      // Use the smaller ratio to ensure the canvas fits in both dimensions
      // This ensures the entire canvas is visible without overflow
      const calculatedZoom = Math.min(widthZoom, heightZoom);
      
      // Apply a small safety margin (2%) to prevent any edge case overflow
      // Clamp between reasonable bounds (0.05 minimum, 1.0 maximum)
      const safeZoom = Math.max(0.05, Math.min(1.0, calculatedZoom * 0.98));
      
      setZoom(safeZoom);
    };

    // Initial calculation
    updateZoom();
    
    // Observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(updateZoom);
    });
    resizeObserver.observe(previewContainerRef.current);

    // Also listen to window resize as a fallback
    window.addEventListener('resize', updateZoom);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateZoom);
    };
  }, [template, editableData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none! lg:max-w-[80dvw]! w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 shrink-0 border-b">
          <DialogTitle>Template Preview</DialogTitle>
          <DialogDescription className="mt-2">
            Review the generated template with your extracted data. You can accept it or edit it manually.
          </DialogDescription>
        </div>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="w-full rounded-sm">
              <TabsTrigger value="preview" className="rounded">Invoice Preview</TabsTrigger>
              <TabsTrigger value="data" className="rounded">Data Editor</TabsTrigger>
              <TabsTrigger value="details" className="rounded">Template Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-4 px-6 pb-6">
            {editableData && Object.keys(editableData).length > 0 ? (
              <div 
                ref={previewContainerRef}
                className="flex-1 flex items-center justify-center bg-muted/30 rounded-md border p-6 overflow-hidden"
                style={{
                  // Ensure container properly constrains content
                  minWidth: 0,
                  minHeight: 0,
                  position: 'relative',
                }}
              >
                {/* Wrapper to properly constrain scaled canvas */}
                <div 
                  className="flex items-center justify-center w-full h-full"
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    minWidth: 0,
                    minHeight: 0,
                  }}
                >
                  <TemplatePreview
                    template={{
                      ...template,
                      id: "preview-template",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    } as Template}
                    context={editableData}
                    zoom={zoom}
                  />
                </div>
              </div>
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
                <div className="space-y-3">
                  {Object.entries(editableData).map(([key, value]) => {
                    const editingKey = editingKeys[key] ?? key;
                    const isDuplicate = editingKey !== key && editableData[editingKey] !== undefined;
                    
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editingKey}
                            onChange={(e) => handleKeyInputChange(key, e.target.value)}
                            onBlur={(e) => handleKeyBlur(key, e.target.value)}
                            className={`flex-1 ${isDuplicate ? "border-destructive" : ""}`}
                            placeholder="Key"
                            title={isDuplicate ? "This key already exists" : ""}
                          />
                          <Input
                            value={formatBindingValue(value)}
                            onChange={(e) => handleValueChange(key, e.target.value)}
                            readOnly={flowType === "template"}
                            className={`flex-1 ${flowType === "template" ? "bg-muted cursor-not-allowed" : ""}`}
                            placeholder="Value"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(key)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  onClick={handleAdd}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key-Value Pair
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 space-y-4 px-6 pb-6">
            {/* Template Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Page Size: </span>
                    <Badge variant="outline">{template.pageSize}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Elements: </span>
                    <Badge variant="outline">{template.elements.length}</Badge>
                  </div>
                  {template.compliance?.region && (
                    <div>
                      <span className="text-muted-foreground">Region: </span>
                      <Badge variant="outline">{template.compliance.region}</Badge>
                    </div>
                  )}
                </div>

                {/* Elements Summary */}
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Template Elements:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-60 overflow-y-auto">
                    {template.elements.map((el, idx) => {
                      let bindingDisplay = "";
                      // Check if element has a binding property (text, image, input, currency elements)
                      const binding = (el.type === "text" || el.type === "image" || el.type === "input" || el.type === "currency") 
                        ? (el as { binding?: string }).binding 
                        : undefined;
                      if (binding) {
                        bindingDisplay = binding;
                        // If we have extracted data, show the value
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
                </div>
              </CardContent>
            </Card>

            {/* Brand Info */}
            {template.brand && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Brand Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Colors: </span>
                      <div className="flex gap-1 mt-1">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: template.brand.colors.primary }}
                          title="Primary"
                        />
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: template.brand.colors.secondary }}
                          title="Secondary"
                        />
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: template.brand.colors.accent }}
                          title="Accent"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Fonts: </span>
                      <span className="text-xs">{template.brand.fonts.join(", ")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit in Designer
            </Button>
            <Button onClick={handleAccept}>
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

