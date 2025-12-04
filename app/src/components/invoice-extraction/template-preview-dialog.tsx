import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Edit } from "lucide-react";
import type { TemplateData, Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRef, useEffect, useState } from "react";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateData;
  extractedData?: Record<string, InvoiceDataValue>;
  onAccept: () => void;
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
  onAccept,
  onEdit,
}: TemplatePreviewDialogProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);

  // Calculate zoom to fit both width and height
  useEffect(() => {
    if (!template || !previewContainerRef.current || !extractedData) return;

    const PAGE_SIZES: Record<TemplateData["pageSize"], { w: number; h: number }> = {
      A4: { w: 794, h: 1123 },
      Letter: { w: 816, h: 1056 },
    };
    const size = PAGE_SIZES[template.pageSize] ?? PAGE_SIZES.A4;

    const updateZoom = () => {
      if (!previewContainerRef.current) return;
      const container = previewContainerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Account for padding: p-6 (24px all sides)
      const padding = 48; // 24px * 2 (left + right or top + bottom)
      const availableWidth = Math.max(0, containerWidth - padding);
      const availableHeight = Math.max(0, containerHeight - padding);
      
      // Calculate zoom based on both width and height, use the smaller one to ensure it fits
      // When scaling from center, we need to account for the fact that the scaled element
      // will extend beyond its original bounds by (scale - 1) / 2 on each side
      const widthZoom = availableWidth / size.w;
      const heightZoom = availableHeight / size.h;
      const calculatedZoom = Math.min(widthZoom, heightZoom);
      
      // Clamp zoom between 0.1 and 1.0 for reasonable scaling
      // Use a slightly smaller zoom to ensure no overflow
      setZoom(Math.max(0.1, Math.min(0.98, calculatedZoom * 0.98)));
    };

    updateZoom();
    const resizeObserver = new ResizeObserver(updateZoom);
    resizeObserver.observe(previewContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [template, extractedData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
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
              <TabsTrigger value="details" className="rounded">Template Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-4 px-6 pb-6">
            {extractedData ? (
              <div 
                ref={previewContainerRef}
                className="flex-1 flex items-center justify-center overflow-hidden bg-muted/30 rounded-md border p-6"
              >
                <TemplatePreview
                  template={{
                    ...template,
                    id: "preview-template",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  } as Template}
                  context={extractedData}
                  zoom={zoom}
                />
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
                        if (extractedData) {
                          const value = getBindingValue(extractedData, binding);
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
            <Button onClick={onAccept}>
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

