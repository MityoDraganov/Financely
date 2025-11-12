import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateInvoice } from "@/hooks";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { TemplateElement } from "@/core";
import { TemplatePreview } from "@/components/templates/template-preview";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { setBindingValue, getBindingValue } from "@/core/entities/invoice";
import { CurrencyConversionManager } from "@/components/invoice/currency-conversion-manager";
import { CURRENCIES, formatCurrency, getCurrency } from "@/utils/currencies";
import type { ConversionRate } from "@/services/currency-conversion-service";

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
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: templates, isLoading: isTemplatesLoading, isSubscribed } = useTemplates(currentOrganization?.id);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, InvoiceDataValue>>({});
  const [complianceValidation, setComplianceValidation] = useState<{
    valid: boolean;
    region: string;
    missingFields: Array<{ binding: string; label: string; description?: string }>;
    warnings?: string[];
    errors?: string[];
  } | null>(null);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [conversionRates, setConversionRates] = useState<ConversionRate[]>([]);

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
        type = inputEl.variant === "number" ? "number" : inputEl.variant === "date" ? "date" : "text";
      } else if (element.type === "currency") {
        const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
        binding = currencyEl.binding;
        type = "number"; // Currency fields are numeric
      } else if (element.type === "image") {
        const imageEl = element as Extract<TemplateElement, { type: "image" }>;
        binding = imageEl.binding;
        type = "text"; // Image URLs are text
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

  // Auto-fill organization data when template is selected
  useEffect(() => {
    if (!selectedTemplate || !currentOrganization || hasAutoFilled) return;
    
    const newData = { ...formData };
    let hasChanges = false;
    
    // Auto-fill seller/supplier information
    if (currentOrganization.name) {
      const sellerNameBinding = bindings.find(b => 
        b.path === "seller.name" || b.path === "supplier.name"
      );
      if (sellerNameBinding && !getBindingValue(newData, sellerNameBinding.path)) {
        setBindingValue(newData, sellerNameBinding.path, currentOrganization.name);
        hasChanges = true;
      }
    }
    
    // Auto-fill organization address if available
    const orgAddress = currentOrganization.settings?.address;
    if (orgAddress) {
      const sellerAddressBinding = bindings.find(b => 
        b.path === "seller.address" || b.path === "supplier.address"
      );
      if (sellerAddressBinding && !getBindingValue(newData, sellerAddressBinding.path)) {
        // Build address object from organization address
        const addressObj: Record<string, string> = {};
        if (orgAddress.street) addressObj.street = orgAddress.street;
        if (orgAddress.city) addressObj.city = orgAddress.city;
        if (orgAddress.state) addressObj.state = orgAddress.state;
        if (orgAddress.zipCode) addressObj.zipCode = orgAddress.zipCode;
        if (orgAddress.country) addressObj.country = orgAddress.country;
        
        if (Object.keys(addressObj).length > 0) {
          setBindingValue(newData, sellerAddressBinding.path, addressObj);
          hasChanges = true;
        }
      }
    }
    
    // Auto-fill currency
    const currencyBinding = bindings.find(b => b.path === "currency");
    if (currencyBinding && !getBindingValue(newData, currencyBinding.path)) {
      const currency = currentOrganization.settings?.defaultCurrency || "USD";
      setBindingValue(newData, currencyBinding.path, currency);
      hasChanges = true;
    }
    
    // Auto-fill invoice date
    const invoiceDateBinding = bindings.find(b => 
      b.path === "invoiceDate" || b.path === "issueDate"
    );
    if (invoiceDateBinding && !getBindingValue(newData, invoiceDateBinding.path)) {
      setBindingValue(newData, invoiceDateBinding.path, new Date().toISOString().split("T")[0]);
      hasChanges = true;
    }
    
    if (hasChanges) {
      setFormData(newData);
      setHasAutoFilled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, currentOrganization, bindings, hasAutoFilled]); // formData intentionally excluded to prevent infinite loop

  // Real-time compliance validation
  useEffect(() => {
    if (!selectedTemplate || !currentOrganization || Object.keys(formData).length === 0) {
      setComplianceValidation(null);
      return;
    }
    
    const region = invoiceComplianceService.detectRegion(currentOrganization);
    const invoiceData = {
      orgId: currentOrganization.id,
      templateId: selectedTemplate.id,
      data: formData,
      status: "draft" as const,
    };
    
    const validation = invoiceComplianceService.validateInvoice(invoiceData, region);
    setComplianceValidation({
      valid: validation.valid,
      region: validation.region,
      missingFields: validation.missingFields,
      warnings: validation.warnings,
      errors: validation.errors,
    });
  }, [formData, selectedTemplate, currentOrganization]);

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

    if (!currentOrganization) {
      toast.error("Organization not found. Please try again.");
      return;
    }

    // Pre-validate compliance before saving
    const region = invoiceComplianceService.detectRegion(currentOrganization);
    const invoiceData = {
      orgId: currentOrganization.id,
      templateId: selectedTemplate.id,
      data: formData,
      status: "draft" as const,
    };
    
    const validation = invoiceComplianceService.validateInvoice(invoiceData, region);
    
    if (!validation.valid) {
      const missingFieldsList = validation.missingFields
        .map(f => f.label)
        .join(", ");
      toast.error(
        `Invoice is not compliant. Missing required fields: ${missingFieldsList}`,
        { duration: 5000 }
      );
      return;
    }
    
    if (validation.warnings && validation.warnings.length > 0) {
      toast.warning(
        `Invoice has compliance warnings: ${validation.warnings.join(", ")}`,
        { duration: 5000 }
      );
    }

    try {
      // Store conversion rates in invoice data
      const invoiceDataWithRates = {
        ...formData,
        _conversionRates: conversionRates,
        _baseCurrency: baseCurrency,
      };

      const invoicePayload = {
        orgId: currentOrganization.id,
        templateId: selectedTemplate.id,
        data: invoiceDataWithRates,
        status: "draft" as const,
      };

      const result = await createInvoice.mutateAsync(invoicePayload);

      toast.success("Invoice created successfully!");
      navigate(`/invoices/${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create invoice: ${message}`);
    }
  };

  // Get table items for a specific table
  const getTableItems = useCallback((itemsPath: string): TableRow[] => {
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
  }, [formData]);

  // Get base currency from invoice data
  const baseCurrency = useMemo(() => {
    const currency = formData.currency;
    return (typeof currency === "string" && currency) || currentOrganization?.settings?.defaultCurrency || "USD";
  }, [formData, currentOrganization?.settings?.defaultCurrency]);

  // Get all items from all tables for currency conversion
  const allItems = useMemo(() => {
    const items: Array<{ currency?: string; [key: string]: unknown }> = [];
    for (const tableConfig of tableConfigs) {
      const tableItems = getTableItems(tableConfig.itemsPath);
      for (const item of tableItems) {
        items.push(item as { currency?: string; [key: string]: unknown });
      }
    }
    return items;
  }, [tableConfigs, getTableItems]);

  // Calculate totals with currency conversion
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let total = 0;
    
    // Calculate synchronously using available conversion rates
    for (const item of allItems) {
      const itemCurrency = (typeof item.currency === "string" ? item.currency : baseCurrency) || baseCurrency;
      const itemTotal = typeof item.total === "number" ? item.total : 
                       (typeof item.amount === "number" ? item.amount : 0);
      
      if (itemCurrency === baseCurrency) {
        subtotal += itemTotal;
        total += itemTotal;
      } else {
        // Find conversion rate
        const rate = conversionRates.find(
          r => r.fromCurrency === itemCurrency && r.toCurrency === baseCurrency
        );
        
        if (rate) {
          const converted = itemTotal * rate.rate;
          subtotal += converted;
          total += converted;
        } else {
          // No rate yet, add original (will update when rate is fetched)
          subtotal += itemTotal;
          total += itemTotal;
        }
      }
    }
    
    return { subtotal, total };
  }, [allItems, baseCurrency, conversionRates]);

  // Add table row
  const addTableRow = (itemsPath: string, columns: TableColumn[]): void => {
    const items = getValue(itemsPath);
    const itemsArray = Array.isArray(items) ? items : [];
    
    const newRow: TableRow = {};
    columns.forEach((col) => {
      newRow[col.binding] = col.type === "number" ? 0 : "";
    });
    
    // Set default currency for new row
    newRow.currency = baseCurrency;
    
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

  // Show loading state while organization or templates are loading
  if (isOrgLoading || isTemplatesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-96" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no organization
  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Organization Required</h3>
              <p className="text-muted-foreground mb-6">
                You need to be part of an organization to create invoices.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state if no templates
  if (!isTemplatesLoading && (!templates || templates.length === 0)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
              <p className="text-muted-foreground">
                Create a new invoice using your templates
              </p>
            </div>
            
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Templates Available</h3>
                <p className="text-muted-foreground mb-6">
                  You need to create a template before you can create invoices.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => navigate("/designer")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
          <p className="text-muted-foreground">
            Select a template and fill in the details. Your invoice will be generated based on the template design.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Live Preview */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Preview</CardTitle>
                  {isSubscribed && (
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Live sync</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTemplate ? (
                  <div className="w-full overflow-auto border rounded-lg">
                    <TemplatePreview
                      template={selectedTemplate}
                      context={formData}
                      zoom={0.8}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
                    <p className="text-muted-foreground">
                      Choose a template from the sidebar to preview your invoice
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Form Sidebar */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Template Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Choose a template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {(templates ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <span>{t.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedTemplate && (
                    <div className="text-sm text-muted-foreground">
                      <p><strong>Description:</strong> {selectedTemplate.description || "No description"}</p>
                      <p><strong>Status:</strong> {selectedTemplate.status || "Active"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dynamic Fields */}
              {bindings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Compliance Status Indicator */}
                    {complianceValidation && (
                      <Alert className={complianceValidation.valid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
                        {complianceValidation.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        )}
                        <AlertDescription className="text-xs">
                          <div className="font-medium mb-1">
                            {complianceValidation.valid ? "✅ Compliant" : "⚠️ Missing Required Fields"}
                          </div>
                          <div className="text-neutral-600 mb-1">
                            Region: {complianceValidation.region}
                          </div>
                          {!complianceValidation.valid && complianceValidation.missingFields.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-amber-700 mb-1">Missing fields:</div>
                              <div className="space-y-1.5">
                                {complianceValidation.missingFields.map((field) => {
                                  // Try to auto-fill from organization data
                                  const handleAutoFill = () => {
                                    const newData = { ...formData };
                                    let value: InvoiceDataValue | undefined;

                                    // Auto-fill logic based on binding
                                    if (field.binding === "seller.name" || field.binding === "supplier.name") {
                                      value = currentOrganization?.name;
                                    } else if (field.binding === "seller.address" || field.binding === "supplier.address") {
                                      const orgAddress = currentOrganization?.settings?.address;
                                      if (orgAddress) {
                                        value = {
                                          street: orgAddress.street || "",
                                          city: orgAddress.city || "",
                                          state: orgAddress.state || "",
                                          zipCode: orgAddress.zipCode || "",
                                          country: orgAddress.country || "",
                                        };
                                      }
                                    } else if (field.binding === "seller.vatId" || field.binding === "supplier.vatId") {
                                      // VAT ID would need to be added to organization settings in the future
                                      // For now, leave it undefined so user can fill it manually
                                      value = undefined;
                                    } else if (field.binding === "invoiceDate" || field.binding === "issueDate") {
                                      value = new Date().toISOString().split("T")[0];
                                    } else if (field.binding === "currency") {
                                      value = currentOrganization?.settings?.defaultCurrency || "USD";
                                    } else if (field.binding === "invoiceNumber") {
                                      // Generate a simple invoice number
                                      value = `INV-${Date.now()}`;
                                    }

                                    if (value !== undefined) {
                                      setBindingValue(newData, field.binding, value);
                                      setFormData(newData);
                                      toast.success(`Auto-filled ${field.label}`);
                                      return;
                                    }

                                    // For fields that cannot be auto-filled, focus and scroll to the field
                                    // Handle special cases first
                                    if (field.binding === "items" || field.binding.endsWith(".items") || field.binding.includes("items")) {
                                      // Find the table section and scroll to it
                                      const itemsTableConfig = tableConfigs.find(tc => 
                                        tc.itemsPath === field.binding || 
                                        tc.itemsPath.endsWith(field.binding) ||
                                        field.binding.includes(tc.itemsPath) ||
                                        tc.itemsPath.includes(field.binding.split(".").pop() || "")
                                      );
                                      if (itemsTableConfig) {
                                        // Get current table items to check if empty
                                        const currentTableItems = getTableItems(itemsTableConfig.itemsPath);
                                        // Try to find the table card
                                        setTimeout(() => {
                                          const tableCard = document.querySelector(`[data-table-path="${itemsTableConfig.itemsPath}"]`);
                                          if (tableCard) {
                                            tableCard.scrollIntoView({ behavior: "smooth", block: "center" });
                                            // Try to focus the "Add Row" button first (if table is empty), then first input
                                            setTimeout(() => {
                                              const addButton = tableCard.querySelector('button[type="button"]');
                                              const firstInput = tableCard.querySelector('input');
                                              if (addButton && currentTableItems.length === 0) {
                                                (addButton as HTMLElement).focus();
                                                toast.info(`Please click "Add Row" to add items to ${field.label}`);
                                              } else if (firstInput) {
                                                firstInput.focus();
                                                toast.info(`Please fill in ${field.label}`);
                                              } else if (addButton) {
                                                (addButton as HTMLElement).focus();
                                                toast.info(`Please add items to ${field.label}`);
                                              }
                                            }, 200);
                                            return;
                                          }
                                        }, 100);
                                        // Fallback: scroll to tables section
                                        const tablesSection = document.querySelector('[data-section="tables"]');
                                        if (tablesSection) {
                                          tablesSection.scrollIntoView({ behavior: "smooth", block: "center" });
                                          toast.info(`Please add items to ${field.label}`);
                                          return;
                                        }
                                      } else {
                                        // No matching table config, scroll to tables section
                                        setTimeout(() => {
                                          const tablesSection = document.querySelector('[data-section="tables"]');
                                          if (tablesSection) {
                                            tablesSection.scrollIntoView({ behavior: "smooth", block: "center" });
                                            toast.info(`Please add items to ${field.label}`);
                                          }
                                        }, 100);
                                        return;
                                      }
                                    }

                                    // Check if this is a calculated field that we can compute
                                    const calculatedFields = ["total", "grossTotal", "netAmount", "subtotal", "vatTotal", "taxTotal"];
                                    const isCalculatedField = calculatedFields.includes(field.binding);
                                    
                                    if (isCalculatedField) {
                                      // Try to calculate the value from items
                                      const items = getValue("items");
                                      if (Array.isArray(items) && items.length > 0) {
                                        let calculatedValue = 0;
                                        
                                        if (field.binding === "total" || field.binding === "grossTotal") {
                                          // Calculate total from items
                                          for (const item of items) {
                                            if (typeof item === "object" && item !== null) {
                                              const itemTotal = (item as TableRow).total || (item as TableRow).amount || 0;
                                              calculatedValue += typeof itemTotal === "number" ? itemTotal : 0;
                                            }
                                          }
                                          // Add VAT if it exists
                                          const vatTotal = getValue("vatTotal");
                                          if (typeof vatTotal === "number") {
                                            calculatedValue += vatTotal;
                                          }
                                        } else if (field.binding === "netAmount" || field.binding === "subtotal") {
                                          // Calculate subtotal (without tax)
                                          for (const item of items) {
                                            if (typeof item === "object" && item !== null) {
                                              const itemTotal = (item as TableRow).total || (item as TableRow).amount || 0;
                                              calculatedValue += typeof itemTotal === "number" ? itemTotal : 0;
                                            }
                                          }
                                        } else if (field.binding === "vatTotal" || field.binding === "taxTotal") {
                                          // VAT/tax might need to be calculated from items or set to 0
                                          calculatedValue = 0;
                                        }
                                        
                                        // Set the calculated value
                                        setBindingValue(newData, field.binding, calculatedValue);
                                        setFormData(newData);
                                        toast.success(`Calculated ${field.label}: ${calculatedValue.toFixed(2)}`);
                                        return;
                                      } else {
                                        // No items yet, try to find the field in bindings or create a placeholder
                                        toast.info(`Please add items first, then ${field.label} will be calculated automatically`);
                                        // Scroll to items table
                                        setTimeout(() => {
                                          const tablesSection = document.querySelector('[data-section="tables"]');
                                          if (tablesSection) {
                                            tablesSection.scrollIntoView({ behavior: "smooth", block: "center" });
                                          }
                                        }, 100);
                                        return;
                                      }
                                    }

                                    // For regular input fields, find and focus them
                                    const bindingField = bindings.find(b => b.path === field.binding);
                                    if (bindingField) {
                                      const inputId = `binding-${field.binding}`;
                                      setTimeout(() => {
                                        const input = document.getElementById(inputId);
                                        if (input) {
                                          input.focus();
                                          input.scrollIntoView({ behavior: "smooth", block: "center" });
                                          // For number inputs, select the text if it's empty or 0
                                          if (input instanceof HTMLInputElement && input.type === "number" && (input.value === "" || input.value === "0")) {
                                            input.select();
                                          }
                                        } else {
                                          toast.info(`Please fill in ${field.label} manually`);
                                        }
                                      }, 100);
                                    } else {
                                      // Field not found in bindings - try to find similar field names
                                      const similarField = bindings.find(b => 
                                        b.path.toLowerCase().includes(field.binding.toLowerCase()) ||
                                        field.binding.toLowerCase().includes(b.path.toLowerCase())
                                      );
                                      
                                      if (similarField) {
                                        // Found a similar field, focus it
                                        const inputId = `binding-${similarField.path}`;
                                        setTimeout(() => {
                                          const input = document.getElementById(inputId);
                                          if (input) {
                                            input.focus();
                                            input.scrollIntoView({ behavior: "smooth", block: "center" });
                                            toast.info(`Focused similar field: ${similarField.label}`);
                                          } else {
                                            toast.info(`Field "${field.label}" not found in template. Please add it in the template designer.`);
                                          }
                                        }, 100);
                                      } else {
                                        // Field not found at all - might be missing from template
                                        toast.warning(`Field "${field.label}" (${field.binding}) is not in the template. Please add it in the template designer.`);
                                      }
                                    }
                                  };

                                  return (
                                    <div key={field.binding} className="flex items-center justify-between gap-2 p-1.5 bg-amber-50 rounded border border-amber-200">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-amber-800 truncate">
                                          {field.label}
                                        </div>
                                        {field.description && (
                                          <div className="text-xs text-amber-600 truncate">
                                            {field.description}
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
                                        onClick={handleAutoFill}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Fill
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {complianceValidation.warnings && complianceValidation.warnings.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-amber-700 mb-1">Warnings:</div>
                              <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                                {complianceValidation.warnings.map((warning, idx) => (
                                  <li key={idx}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    {bindings.map((field) => {
                      // Auto-calculate totals if they're empty and we have items
                      const shouldAutoCalculate = (
                        (field.path === "total" || field.path === "grossTotal") && 
                        !getValue(field.path) &&
                        allItems.length > 0
                      ) || (
                        (field.path === "subtotal" || field.path === "netAmount") &&
                        !getValue(field.path) &&
                        allItems.length > 0
                      );
                      
                      return (
                      <div key={field.path} className="space-y-2">
                          <div className="flex items-center justify-between">
                        <Label htmlFor={field.path}>{field.label}</Label>
                            {shouldAutoCalculate && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  if (field.path === "total" || field.path === "grossTotal") {
                                    setValue(field.path, calculatedTotals.total);
                                  } else if (field.path === "subtotal" || field.path === "netAmount") {
                                    setValue(field.path, calculatedTotals.subtotal);
                                  }
                                }}
                              >
                                Auto-calculate
                              </Button>
                            )}
                          </div>
                        <Input
                            id={`binding-${field.path}`}
                          type={field.type}
                          value={String(getValue(field.path) ?? "")}
                          onChange={(e) => {
                            const val: InvoiceDataValue =
                              field.type === "number"
                                ? Number(e.target.value)
                                : e.target.value;
                            setValue(field.path, val);
                          }}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                          {shouldAutoCalculate && (
                            <p className="text-xs text-muted-foreground">
                              Suggested: {formatCurrency(
                                field.path === "total" || field.path === "grossTotal" 
                                  ? calculatedTotals.total 
                                  : calculatedTotals.subtotal,
                                baseCurrency
                              )}
                            </p>
                          )}
                      </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Dynamic Tables - render a card for each table in template */}
              <div data-section="tables">
              {tableConfigs.map((tableConfig, tableIndex) => {
                const tableItems = getTableItems(tableConfig.itemsPath);
                const tableLabel = tableConfig.itemsPath
                  .split(".")
                  .pop()!
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase());
                
                return (
                  <Card key={`table-${tableIndex}`} data-table-path={tableConfig.itemsPath}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{tableLabel}</CardTitle>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTableRow(tableConfig.itemsPath, tableConfig.columns)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Row
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {tableItems.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <p>No {tableLabel.toLowerCase()} added yet.</p>
                          <p className="text-sm">Click "Add Row" to get started.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tableItems.map((row, rowIndex) => (
                            <div key={rowIndex} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Row {rowIndex + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTableRow(tableConfig.itemsPath, rowIndex)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {tableConfig.columns.map((col) => (
                                  <div key={col.id} className="space-y-2">
                                    <Label htmlFor={`${tableConfig.itemsPath}-${rowIndex}-${col.binding}`}>
                                      {col.header}
                                    </Label>
                                    <Input
                                      id={`${tableConfig.itemsPath}-${rowIndex}-${col.binding}`}
                                      type={col.type}
                                      value={String(row[col.binding] ?? "")}
                                      onChange={(e) => {
                                        const val: InvoiceDataValue =
                                          col.type === "number"
                                            ? Number(e.target.value)
                                            : e.target.value;
                                        updateTableCell(tableConfig.itemsPath, rowIndex, col.binding, val);
                                      }}
                                      placeholder={`Enter ${col.header.toLowerCase()}`}
                                    />
                                  </div>
                                ))}
                                {/* Currency selector for each item */}
                                <div className="space-y-2 sm:col-span-2">
                                  <Label htmlFor={`${tableConfig.itemsPath}-${rowIndex}-currency`}>
                                    Currency
                                  </Label>
                                  <Select
                                    value={String(row.currency || baseCurrency)}
                                    onValueChange={(value) => {
                                      updateTableCell(tableConfig.itemsPath, rowIndex, "currency", value);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CURRENCIES.map((currency) => (
                                        <SelectItem key={currency.code} value={currency.code}>
                                          {currency.code} - {currency.name} {currency.symbol ? `(${currency.symbol})` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {(() => {
                                    const itemCurrency = typeof row.currency === "string" ? row.currency : baseCurrency;
                                    if (itemCurrency === baseCurrency) return null;
                                    
                                    const itemTotal = typeof row.total === "number" ? row.total : 
                                                     (typeof row.amount === "number" ? row.amount : 0);
                                    const rate = conversionRates.find(
                                      r => r.fromCurrency === itemCurrency && r.toCurrency === baseCurrency
                                    );
                                    const convertedAmount = rate ? itemTotal * rate.rate : itemTotal;
                                    const fromCurrencyInfo = getCurrency(itemCurrency);
                                    const toCurrencyInfo = getCurrency(baseCurrency);
                                    
                                    return (
                                      <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                          This item will be converted to {baseCurrency} for totals
                                        </p>
                                        {rate && itemTotal > 0 && (
                                          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                            <div className="font-medium text-blue-900 mb-1">Conversion Preview:</div>
                                            <div className="text-blue-700 space-y-0.5">
                                              <div>
                                                Original: {formatCurrency(itemTotal, itemCurrency)}
                                                {fromCurrencyInfo?.symbol && ` (${fromCurrencyInfo.symbol})`}
                                              </div>
                                              <div className="font-medium">
                                                Converted: {formatCurrency(convertedAmount, baseCurrency)}
                                                {toCurrencyInfo?.symbol && ` (${toCurrencyInfo.symbol})`}
                                              </div>
                                              <div className="text-blue-600">
                                                Rate: 1 {itemCurrency} = {rate.rate.toFixed(4)} {baseCurrency}
                                                {rate.manualOverride ? " (Manual)" : " (Live)"}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        {!rate && itemTotal > 0 && (
                                          <p className="text-xs text-amber-600">
                                            ⏳ Fetching conversion rate...
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              </div>

              {/* Currency Conversion Manager */}
              {allItems.length > 0 && (
                <CurrencyConversionManager
                  baseCurrency={baseCurrency}
                  items={allItems}
                  existingRates={conversionRates}
                  onRatesChange={setConversionRates}
                />
              )}

              {/* Submit */}
              <Card>
                <CardContent className="pt-6">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createInvoice.isPending || !selectedTemplate}
                    size="lg"
                  >
                    {createInvoice.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Invoice...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Create Invoice
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
