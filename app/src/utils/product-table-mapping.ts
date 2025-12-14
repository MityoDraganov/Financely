import type { Product } from "@/core/entities/product";
import type {
	Template,
	TemplateElement,
	ProductTableConfig,
	ProductTableColumnMapping,
} from "@/core/entities/template";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { getExchangeRate } from "@/utils/currencies";

/**
 * Round currency values to 2 decimal places
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get value from product by field name
 */
function getProductFieldValue(
  product: Product,
  field: ProductTableColumnMapping["productField"]
): InvoiceDataValue {
  switch (field) {
    case "name":
      return product.name;
    case "description":
      return product.description || "";
    case "price":
      return product.price;
    case "currency":
      return product.currency;
    case "sku":
      return product.sku || "";
    case "barcode":
      return product.barcode || "";
    case "category":
      return product.category || "";
    case "taxRate":
      return product.taxRate || 0;
    case "cost":
      return product.cost || 0;
    default:
      return "";
  }
}

/**
 * Apply transformation to a value based on mapping config
 */
async function applyTransform(
  value: InvoiceDataValue,
  mapping: ProductTableColumnMapping,
  product: Product,
  defaultCurrency: string
): Promise<InvoiceDataValue> {
  if (mapping.transform === "none") {
    return value;
  }

  if (mapping.transform === "currency_convert") {
    if (typeof value !== "number") {
      return value;
    }

    const sourceCurrency = product.currency;
    const targetCurrency = mapping.targetCurrency || defaultCurrency;

    if (sourceCurrency === targetCurrency) {
      return roundCurrency(value);
    }

    try {
      const rate = await getExchangeRate(sourceCurrency, targetCurrency);
      const converted = value * rate;
      return roundCurrency(converted);
    } catch (error) {
      console.error("Failed to convert currency:", error);
      return value; // Fallback to original value
    }
  }

  if (mapping.transform === "format_number") {
    if (typeof value === "number") {
      return roundCurrency(value);
    }
    return value;
  }

  return value;
}

/**
 * Map a product to an invoice table row using the template's product table config
 * 
 * @param product - The product to map
 * @param config - The product table configuration from the template
 * @param rowIndex - The index of the row in the table (for array path generation)
 * @returns Object with mapped row data and locked fields
 */
export async function mapProductToTableRow(
  product: Product,
  config: ProductTableConfig,
  rowIndex: number = 0
): Promise<{
  rowData: Record<string, InvoiceDataValue>;
  lockedFields: Set<string>;
}> {
  const rowData: Record<string, InvoiceDataValue> = {};
  const lockedFields = new Set<string>();

  // Apply each column mapping
  for (const mapping of config.columnMappings) {
    const productValue = getProductFieldValue(product, mapping.productField);
    const transformedValue = await applyTransform(
      productValue,
      mapping,
      product,
      config.defaultCurrency
    );

    rowData[mapping.columnBinding] = transformedValue;

    if (mapping.lockOnProductSelect) {
      lockedFields.add(mapping.columnBinding);
    }
  }

  // Handle quantity if autoQuantity is enabled
  if (config.autoQuantity) {
    rowData.quantity = config.defaultQuantity;
    if (config.autoQuantity) {
      lockedFields.add("quantity");
    }
  }

  return { rowData, lockedFields };
}

/**
 * Get default product table config for a template
 * Creates a sensible default mapping based on common invoice table columns
 * 
 * @param template - The template to generate default config for
 * @returns Default product table config or null if no table found
 */
export function getDefaultProductTableConfig(template: Template): ProductTableConfig | null {
  // Find the first table element with an itemsBinding
  const tableElement = template.elements?.find(
    (el): el is Extract<TemplateElement, { type: "table" }> =>
      el.type === "table" && !!(el as Extract<TemplateElement, { type: "table" }>).itemsBinding
  );

  if (!tableElement || !tableElement.itemsBinding) {
    return null;
  }

  const columns = tableElement.columns || [];
  
  // Build default mappings based on column bindings
  const columnMappings: ProductTableColumnMapping[] = [];

  for (const col of columns) {
    if (!col.binding) continue;

    const bindingLower = col.binding.toLowerCase();
    let productField: ProductTableColumnMapping["productField"] | null = null;
    let transform: ProductTableColumnMapping["transform"] = "none";
    let targetCurrency: string | undefined = undefined;

    // Map common column bindings to product fields
    if (
      bindingLower.includes("description") ||
      bindingLower.includes("name") ||
      bindingLower === "itemdescription"
    ) {
      productField = "description";
    } else if (
      bindingLower.includes("price") ||
      bindingLower.includes("amount") ||
      bindingLower === "unitprice"
    ) {
      productField = "price";
      transform = col.type === "currency" ? "currency_convert" : "format_number";
      if (col.type === "currency" && col.currency) {
        targetCurrency = col.currency;
      }
    } else if (bindingLower === "currency" && col.type === "text") {
      productField = "currency";
    } else if (
      bindingLower.includes("sku") ||
      bindingLower.includes("reference") ||
      bindingLower === "itemnumber"
    ) {
      productField = "sku";
    }

    if (productField) {
      columnMappings.push({
        columnBinding: col.binding,
        productField,
        transform,
        targetCurrency,
        lockOnProductSelect: true,
      });
    }
  }

  // If no mappings found, create basic defaults
  if (columnMappings.length === 0) {
    // Try to find common column names
    const descriptionCol = columns.find(
      (c) => c.binding && (c.binding.toLowerCase().includes("description") || c.binding.toLowerCase().includes("name"))
    );
    const priceCol = columns.find(
      (c) => (c.type === "currency" || c.type === "number") && c.binding
    );

    if (descriptionCol?.binding) {
      columnMappings.push({
        columnBinding: descriptionCol.binding,
        productField: "description",
        transform: "none",
        lockOnProductSelect: true,
      });
    }

    if (priceCol?.binding) {
      columnMappings.push({
        columnBinding: priceCol.binding,
        productField: "price",
        transform: priceCol.type === "currency" ? "currency_convert" : "format_number",
        targetCurrency: priceCol.type === "currency" && "currency" in priceCol ? priceCol.currency : undefined,
        lockOnProductSelect: true,
      });
    }
  }

  return {
    itemsBinding: tableElement.itemsBinding,
    columnMappings,
    autoQuantity: false,
    defaultQuantity: 1,
    autoConvertCurrency: true,
    defaultCurrency: "USD",
  };
}

/**
 * Check if a template has a valid product table config
 */
export function hasProductTableConfig(template: Template): boolean {
  return !!(
    template.productTableConfig &&
    template.productTableConfig.itemsBinding &&
    template.productTableConfig.columnMappings.length > 0
  );
}


