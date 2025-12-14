import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, Sparkles, Loader2 } from "lucide-react";
import type { Template, TemplateElement, ProductTableConfig, ProductTableColumnMapping } from "@/core/entities/template";
import { toast } from "sonner";
import { functionsService } from "@/services/functions/functions-service";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { getMappableProductFields } from "@/utils/product-fields";

type ProductField = ProductTableColumnMapping["productField"];

// Get product fields from the Product entity
const PRODUCT_FIELDS = getMappableProductFields();

interface ProductTableConfigPanelProps {
  template: Template;
  selectedTable: Extract<TemplateElement, { type: "table" }>;
  onSave: (config: ProductTableConfig) => void;
  isSaving?: boolean;
}

export function ProductTableConfigPanel({
  template,
  selectedTable,
  onSave,
  isSaving = false,
}: ProductTableConfigPanelProps) {
  const { data: currentOrganization } = useCurrentOrganization();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Use the selected table's itemsBinding
  const selectedTableBinding = selectedTable.itemsBinding || "items";
  const currentTable = selectedTable;
  const currentConfig = template.productTableConfig?.itemsBinding === selectedTableBinding
    ? template.productTableConfig
    : null;

  const [columnMappings, setColumnMappings] = useState<ProductTableColumnMapping[]>(
    currentConfig?.columnMappings || []
  );
  const [autoQuantity, setAutoQuantity] = useState(currentConfig?.autoQuantity || false);
  const [defaultQuantity, setDefaultQuantity] = useState(currentConfig?.defaultQuantity || 1);
  const [autoConvertCurrency, setAutoConvertCurrency] = useState(
    currentConfig?.autoConvertCurrency ?? true
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    currentConfig?.defaultCurrency || "USD"
  );

  // Get available columns for the selected table
  const availableColumns = useMemo(() => {
    if (!currentTable) return [];
    return currentTable.columns || [];
  }, [currentTable]);

  // Check if this table has a binding (required for product mapping)
  if (!selectedTable.itemsBinding) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Table Configuration</CardTitle>
          <CardDescription>
            Configure how products map to invoice table columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This table needs an items binding to configure product mapping. Set the items binding in the table properties.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Add a new column mapping
  const handleAddMapping = () => {
    if (availableColumns.length === 0) {
      toast.error("No columns available in this table");
      return;
    }

    const firstColumn = availableColumns[0];
    const newMapping: ProductTableColumnMapping = {
      columnBinding: firstColumn.binding || firstColumn.id,
      productField: "name",
      transform: "none",
      lockOnProductSelect: true,
    };

    setColumnMappings([...columnMappings, newMapping]);
  };

  // Remove a column mapping
  const handleRemoveMapping = (index: number) => {
    setColumnMappings(columnMappings.filter((_, i) => i !== index));
  };

  // Update a column mapping
  const handleUpdateMapping = (
    index: number,
    updates: Partial<ProductTableColumnMapping>
  ) => {
    const updated = [...columnMappings];
    updated[index] = { ...updated[index], ...updates };
    setColumnMappings(updated);
  };

  // Handle AI generation
  const handleGenerateWithAI = async () => {
    if (!currentOrganization) {
      toast.error("Organization not found");
      return;
    }

    if (!template.id) {
      toast.error("Template ID is required");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const result = await functionsService.generateProductTableConfig({
        templateId: template.id,
        organizationId: currentOrganization.id,
        itemsBinding: selectedTableBinding,
      });

      if (result.productTableConfig) {
        // Update state with AI-generated config
        setColumnMappings(result.productTableConfig.columnMappings);
        setAutoQuantity(result.productTableConfig.autoQuantity ?? false);
        setDefaultQuantity(result.productTableConfig.defaultQuantity ?? 1);
        setAutoConvertCurrency(result.productTableConfig.autoConvertCurrency ?? true);
        setDefaultCurrency(result.productTableConfig.defaultCurrency || "USD");

        toast.success(
          `AI generated ${result.productTableConfig.columnMappings.length} column mapping(s). Review and save when ready.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`AI generation failed: ${message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handle save
  const handleSave = () => {
    if (columnMappings.length === 0) {
      toast.error("Please add at least one column mapping");
      return;
    }

    const config: ProductTableConfig = {
      itemsBinding: selectedTableBinding,
      columnMappings,
      autoQuantity,
      defaultQuantity,
      autoConvertCurrency,
      defaultCurrency,
    };

    onSave(config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Table Configuration</CardTitle>
        <CardDescription>
          Configure how products map to invoice table columns. This mapping will be applied
          automatically when products are selected during invoice creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {currentTable && (
          <>
            {/* Column Mappings */}
            <div className="space-y-4 w-full">
              <div className="flex flex-col justify-between gap-2 w-full">
                <Label>Column Mappings</Label>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    type="button"
                    variant="ai"
                    size="sm"
                    onClick={handleGenerateWithAI}
                    disabled={availableColumns.length === 0 || isGeneratingAI || !currentOrganization || !template.id || !selectedTableBinding}
                    title="Use AI to automatically generate column mappings"
                    className="flex-1 py-2.5"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMapping}
                    disabled={availableColumns.length === 0}
                    className="flex-1 py-1.5"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Mapping
                  </Button>
                </div>
              </div>

              {columnMappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mappings configured. Click "Add Mapping" to create one.
                </p>
              ) : (
                <div className="space-y-3">
                  {columnMappings.map((mapping, index) => {
                    const column = availableColumns.find(
                      (c) => c.binding === mapping.columnBinding || c.id === mapping.columnBinding
                    );

                    return (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                              {/* Column Selection */}
                              <div className="space-y-2">
                                <Label>Table Column</Label>
                                <Select
                                  value={mapping.columnBinding}
                                  onValueChange={(value) =>
                                    handleUpdateMapping(index, { columnBinding: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableColumns.map((col) => (
                                      <SelectItem
                                        key={col.id}
                                        value={col.binding || col.id}
                                      >
                                        {col.header || col.binding || col.id} ({col.type})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Product Field Selection */}
                              <div className="space-y-2">
                                <Label>Product Field</Label>
                                <Select
                                  value={mapping.productField}
                                  onValueChange={(value: ProductField) =>
                                    handleUpdateMapping(index, { productField: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRODUCT_FIELDS.map((field) => (
                                      <SelectItem key={field.value} value={field.value}>
                                        <div>
                                          <div className="font-medium">{field.label}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {field.description}
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Transform Selection (only for price/number fields) */}
                              {(mapping.productField === "price" ||
                                mapping.productField === "cost" ||
                                mapping.productField === "taxRate") && (
                                <div className="space-y-2">
                                  <Label>Transformation</Label>
                                  <Select
                                    value={mapping.transform}
                                    onValueChange={(
                                      value: ProductTableColumnMapping["transform"]
                                    ) => handleUpdateMapping(index, { transform: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="format_number">Format Number</SelectItem>
                                      {column?.type === "currency" && (
                                        <SelectItem value="currency_convert">
                                          Convert Currency
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Target Currency (for currency conversion) */}
                              {mapping.transform === "currency_convert" && (
                                <div className="space-y-2">
                                  <Label>Target Currency</Label>
                                  <Input
                                    type="text"
                                    placeholder="USD"
                                    value={mapping.targetCurrency || ""}
                                    onChange={(e) =>
                                      handleUpdateMapping(index, {
                                        targetCurrency: e.target.value.toUpperCase().slice(0, 3),
                                      })
                                    }
                                    maxLength={3}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Leave empty to use table default currency
                                  </p>
                                </div>
                              )}

                              {/* Lock on Product Select */}
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label>Lock Field</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Lock this field when product is selected
                                  </p>
                                </div>
                                <Switch
                                  checked={mapping.lockOnProductSelect}
                                  onCheckedChange={(checked) =>
                                    handleUpdateMapping(index, { lockOnProductSelect: checked })
                                  }
                                />
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMapping(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Auto Quantity Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Populate Quantity</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically set quantity when product is selected
                  </p>
                </div>
                <Switch checked={autoQuantity} onCheckedChange={setAutoQuantity} />
              </div>

              {autoQuantity && (
                <div className="space-y-2">
                  <Label htmlFor="default-quantity">Default Quantity</Label>
                  <Input
                    id="default-quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={defaultQuantity}
                    onChange={(e) => setDefaultQuantity(parseFloat(e.target.value) || 1)}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Currency Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Convert Currency</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically convert product currency to table currency
                  </p>
                </div>
                <Switch
                  checked={autoConvertCurrency}
                  onCheckedChange={setAutoConvertCurrency}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-currency">Default Currency</Label>
                <Input
                  id="default-currency"
                  type="text"
                  placeholder="USD"
                  value={defaultCurrency}
                  onChange={(e) =>
                    setDefaultCurrency(e.target.value.toUpperCase().slice(0, 3))
                  }
                  maxLength={3}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving || columnMappings.length === 0}>
                {isSaving ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

