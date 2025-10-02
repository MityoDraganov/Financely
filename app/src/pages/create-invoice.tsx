import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateInvoice } from "@/hooks";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { TemplateElement } from "@/core";
import { TemplatePreview } from "@/components/templates/template-preview";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { InvoiceDataValue } from "@/core/entities/invoice";

type BindingField = {
  path: string;
  label: string;
  type: "text" | "number" | "date";
};

type TableColumn = {
  id: string;
  header: string;
  binding: string;
  type: "text" | "number" | "date";
};

type TableConfig = {
  itemsPath: string;
  columns: TableColumn[];
};

type TableRow = Record<string, InvoiceDataValue>;

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const { data: templates } = useTemplates();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, InvoiceDataValue>>({});

  // Get selected template
  const selectedTemplate = useMemo(() => {
    const list = templates ?? [];
    if (!selectedTemplateId && list.length > 0) {
      setSelectedTemplateId(list[0].id);
      return list[0];
    }
    return list.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Extract table configuration first (supports multiple tables)
  const tableConfigs = useMemo((): TableConfig[] => {
    if (!selectedTemplate) return [];
    
    const tableElements = (selectedTemplate.elements ?? []).filter(
      (e) => e.type === "table"
    ) as Extract<TemplateElement, { type: "table" }>[];
    
    return tableElements
      .filter((tableEl) => tableEl.itemsBinding) // Only include tables with bindings
      .map((tableEl) => ({
        itemsPath: tableEl.itemsBinding,
        columns: (tableEl.columns ?? []).map((col): TableColumn => ({
          id: col.id,
          header: col.header || "Column",
          binding: col.binding || col.id,
          type: col.type || "text",
        })),
      }));
  }, [selectedTemplate]);

  // Extract bindings from template elements (depends on tableConfigs)
  const bindings = useMemo((): BindingField[] => {
    if (!selectedTemplate) return [];
    
    const fields = new Map<string, BindingField>();
    const elements = selectedTemplate.elements ?? [];
    
    for (const element of elements) {
      let binding: string | undefined;
      let type: "text" | "number" | "date" = "text";
      
      if (element.type === "text") {
        const textEl = element as Extract<TemplateElement, { type: "text" }>;
        binding = textEl.binding;
      } else if (element.type === "input") {
        const inputEl = element as Extract<TemplateElement, { type: "input" }>;
        binding = inputEl.binding;
        type = inputEl.variant || "text";
      }
      
      if (binding) {
        // Skip bindings that are table paths (these are handled separately)
        const isTableBinding = tableConfigs.some((tc) => binding.startsWith(tc.itemsPath));
        if (isTableBinding) continue;
        const label = binding
          .split(".")
          .pop()!
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (c) => c.toUpperCase());
        
        if (!fields.has(binding)) {
          fields.set(binding, { path: binding, label, type });
        }
      }
    }
    
    return Array.from(fields.values());
  }, [selectedTemplate, tableConfigs]);

  // Get value from nested path
  const getValue = (path: string): InvoiceDataValue => {
    const parts = path.split(".");
    let value: InvoiceDataValue = formData;
    
    for (const part of parts) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        value = value[part];
      } else {
        return "";
      }
    }
    
    return value ?? "";
  };

  // Set value at nested path (creates new references at each level for proper React re-rendering)
  const setValue = (path: string, value: InvoiceDataValue): void => {
    const parts = path.split(".");
    
    // Create a deep clone with new references at each level in the path
    const newData = { ...formData };
    const pathToUpdate: Record<string, InvoiceDataValue>[] = [newData];
    let current: Record<string, InvoiceDataValue> = newData;
    
    // Navigate to the parent of the target, creating new object references
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const next = current[part];
      
      if (next && typeof next === "object" && !Array.isArray(next)) {
        // Clone the nested object to create a new reference
        current[part] = { ...next as Record<string, InvoiceDataValue> };
      } else {
        // Create new object if it doesn't exist or isn't an object
        current[part] = {};
      }
      
      current = current[part] as Record<string, InvoiceDataValue>;
      pathToUpdate.push(current);
    }
    
    // Set the final value
    current[parts[parts.length - 1]] = value;
    
    setFormData(newData);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    try {
      const result = await createInvoice.mutateAsync({
        orgId: "default-org", // TODO: Get from auth context
        templateId: selectedTemplate.id,
        data: formData,
        status: "draft",
      });

      toast.success("Invoice created successfully!");
      navigate(`/invoices/${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create invoice: ${message}`);
    }
  };

  // Add table row
  const addTableRow = (itemsPath: string, columns: TableColumn[]): void => {
    const items = getValue(itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    const newRow: TableRow = {};
    columns.forEach((col) => {
      newRow[col.binding] = col.type === "number" ? 0 : "";
    });
    
    setValue(itemsPath, [...itemsArray, newRow]);
  };

  // Remove table row
  const removeTableRow = (itemsPath: string, index: number): void => {
    const items = getValue(itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    setValue(
      itemsPath,
      itemsArray.filter((_: InvoiceDataValue, i: number) => i !== index)
    );
  };

  // Update table cell (creates new array and object references)
  const updateTableCell = (itemsPath: string, rowIndex: number, binding: string, value: InvoiceDataValue): void => {
    const items = getValue(itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    // Create a new array with new object references for immutability
    const newItemsArray = itemsArray.map((item, idx) => {
      if (idx === rowIndex) {
        // Create new object for the row being updated
        const currentRow = (item && typeof item === "object" && !Array.isArray(item)) 
          ? item as TableRow 
          : {};
        return { ...currentRow, [binding]: value };
      }
      return item;
    });
    
    // If row doesn't exist yet, add it
    if (rowIndex >= newItemsArray.length) {
      const newRow: TableRow = { [binding]: value };
      newItemsArray[rowIndex] = newRow;
    }
    
    setValue(itemsPath, newItemsArray);
  };

  // Get table items for a specific table
  const getTableItems = (itemsPath: string): TableRow[] => {
    const parts = itemsPath.split(".");
    let value: InvoiceDataValue = formData;
    
    for (const part of parts) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        value = value[part];
      } else {
        return [];
      }
    }
    
    if (!Array.isArray(value)) return [];
    
    return value.filter((item): item is TableRow => 
      typeof item === "object" && item !== null && !Array.isArray(item)
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#eafcff] to-white p-6 md:p-10 border border-custom">
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight mb-3">
          Create Invoice
        </h1>
        <p className="text-gray max-w-2xl">
          Select a template and fill in the details. Your invoice will be generated based on the template design.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live Preview */}
        <div className="lg:col-span-2">
          <Card className="card-large">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <div className="w-full overflow-auto">
                  <TemplatePreview
                    template={selectedTemplate}
                    context={formData}
                    zoom={0.95}
                  />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a template to preview your invoice
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Form Sidebar */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Template Selection */}
            <Card className="card-large">
              <CardHeader>
                <CardTitle>Template</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Choose a template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Dynamic Fields */}
            {bindings.length > 0 && (
              <Card className="card-large">
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bindings.map((field) => (
                    <div key={field.path}>
                      <Label>{field.label}</Label>
                      <Input
                        type={field.type}
                        value={String(getValue(field.path) ?? "")}
                        onChange={(e) => {
                          const val: InvoiceDataValue =
                            field.type === "number"
                              ? Number(e.target.value)
                              : e.target.value;
                          setValue(field.path, val);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Dynamic Tables - render a card for each table in template */}
            {tableConfigs.map((tableConfig, tableIndex) => {
              const tableItems = getTableItems(tableConfig.itemsPath);
              const tableLabel = tableConfig.itemsPath
                .split(".")
                .pop()!
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (c) => c.toUpperCase());
              
              return (
                <Card key={`table-${tableIndex}`} className="card-large">
                  <CardHeader>
                    <CardTitle>{tableLabel}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tableItems.map((row, rowIndex) => (
                      <div key={rowIndex} className="p-4 border rounded-lg space-y-3">
                        {tableConfig.columns.map((col) => (
                          <div key={col.id}>
                            <Label>{col.header}</Label>
                            <Input
                              type={col.type}
                              value={String(row[col.binding] ?? "")}
                              onChange={(e) => {
                                const val: InvoiceDataValue =
                                  col.type === "number"
                                    ? Number(e.target.value)
                                    : e.target.value;
                                updateTableCell(tableConfig.itemsPath, rowIndex, col.binding, val);
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTableRow(tableConfig.itemsPath, rowIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addTableRow(tableConfig.itemsPath, tableConfig.columns)}
                    >
                      Add {tableLabel.slice(0, -1) || "Row"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {/* Submit */}
            <Button
              type="submit"
              className="btn-primary"
              disabled={createInvoice.isPending || !selectedTemplate}
            >
              {createInvoice.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
