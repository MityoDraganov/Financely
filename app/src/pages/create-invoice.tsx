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

  // Extract bindings from template elements
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
      
      if (binding && !binding.includes(".items")) {
        // Remove "invoice." prefix if present
        const path = binding.replace(/^invoice\./, "");
        const label = path
          .split(".")
          .pop()!
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (c) => c.toUpperCase());
        
        if (!fields.has(path)) {
          fields.set(path, { path, label, type });
        }
      }
    }
    
    return Array.from(fields.values());
  }, [selectedTemplate]);

  // Extract table configuration
  const tableConfig = useMemo((): TableConfig | null => {
    if (!selectedTemplate) return null;
    
    const tableEl = selectedTemplate.elements?.find(
      (e) => e.type === "table"
    ) as Extract<TemplateElement, { type: "table" }> | undefined;
    
    if (!tableEl || !tableEl.itemsBinding?.includes("items")) return null;
    
    return {
      itemsPath: tableEl.itemsBinding.replace(/^invoice\./, ""),
      columns: (tableEl.columns ?? []).map((col): TableColumn => ({
        id: col.id,
        header: col.header || "Column",
        binding: col.binding?.replace(/^invoice\.items\./, "") || col.id,
        type: col.type || "text",
      })),
    };
  }, [selectedTemplate]);

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

  // Set value at nested path
  const setValue = (path: string, value: InvoiceDataValue): void => {
    const parts = path.split(".");
    const newData: Record<string, InvoiceDataValue> = { ...formData };
    let current: Record<string, InvoiceDataValue> = newData;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const next = current[part];
      
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        current[part] = {};
      }
      current = current[part] as Record<string, InvoiceDataValue>;
    }
    
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
  const addTableRow = (): void => {
    if (!tableConfig) return;
    
    const items = getValue(tableConfig.itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    const newRow: TableRow = {};
    tableConfig.columns.forEach((col) => {
      newRow[col.binding] = col.type === "number" ? 0 : "";
    });
    
    setValue(tableConfig.itemsPath, [...itemsArray, newRow]);
  };

  // Remove table row
  const removeTableRow = (index: number): void => {
    if (!tableConfig) return;
    
    const items = getValue(tableConfig.itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    setValue(
      tableConfig.itemsPath,
      itemsArray.filter((_: InvoiceDataValue, i: number) => i !== index)
    );
  };

  // Update table cell
  const updateTableCell = (rowIndex: number, binding: string, value: InvoiceDataValue): void => {
    if (!tableConfig) return;
    
    const items = getValue(tableConfig.itemsPath);
    const itemsArray = Array.isArray(items) ? [...items] : [];
    
    if (!itemsArray[rowIndex]) {
      itemsArray[rowIndex] = {};
    }
    
    const row = itemsArray[rowIndex];
    if (row && typeof row === "object" && !Array.isArray(row)) {
      (row as TableRow)[binding] = value;
    }
    
    setValue(tableConfig.itemsPath, itemsArray);
  };

  const tableItems = useMemo((): TableRow[] => {
    if (!tableConfig) return [];
    
    // Get items directly from formData to avoid getValue dependency
    const parts = tableConfig.itemsPath.split(".");
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
  }, [tableConfig, formData]);

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
                    context={{ invoice: formData }}
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

            {/* Table Items */}
            {tableConfig && (
              <Card className="card-large">
                <CardHeader>
                  <CardTitle>Items</CardTitle>
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
                              updateTableCell(rowIndex, col.binding, val);
                            }}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTableRow(rowIndex)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addTableRow}
                  >
                    Add Item
                  </Button>
                </CardContent>
              </Card>
            )}

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
