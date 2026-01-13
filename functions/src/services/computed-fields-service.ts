import { DataContext, DataContextValue } from "../core/entities/data-context";

export interface ComputedFieldDefinition {
  key: string;
  compute: (context: DataContext) => DataContextValue | undefined;
}

export class ComputedFieldsService {
  private fields: Map<string, ComputedFieldDefinition> = new Map();
  private computingFields: Set<string> = new Set(); // Track fields currently being computed to prevent recursion

  register(field: ComputedFieldDefinition): void {
    if (this.fields.has(field.key)) {
      throw new Error(`Computed field with key "${field.key}" is already registered`);
    }
    this.fields.set(field.key, field);
  }

  /**
   * Compute a specific field by key
   */
  computeField(key: string, context: DataContext): DataContextValue | undefined {
    const field = this.fields.get(key);
    if (!field) {
      return undefined;
    }
    
    // Prevent infinite recursion
    if (this.computingFields.has(key)) {
      return undefined;
    }
    
    this.computingFields.add(key);
    try {
      return field.compute(context);
    } finally {
      this.computingFields.delete(key);
    }
  }

  computeAll(context: DataContext): Record<string, DataContextValue> {
    const computed: Record<string, DataContextValue> = {};

    for (const [key, field] of this.fields.entries()) {
      // Skip if already computing (prevents recursion)
      if (this.computingFields.has(key)) {
        continue;
      }
      
      try {
        this.computingFields.add(key);
        const value = field.compute(context);
        if (value !== undefined) {
          computed[key] = value;
        }
      } catch (error) {
        console.error(`Error computing field "${key}":`, error);
      } finally {
        this.computingFields.delete(key);
      }
    }

    return computed;
  }
}

export const computedFieldsService = new ComputedFieldsService();

computedFieldsService.register({
  key: "invoiceSubtotal",
  compute: (context) => {
    if (!context.invoice?.data) {
      return undefined;
    }
    const data = context.invoice.data;
    const subtotal = data.subtotal || data.netAmount || data.net;
    if (typeof subtotal === "number") {
      return subtotal;
    }
    if (typeof subtotal === "string") {
      const parsed = parseFloat(subtotal);
      return isNaN(parsed) ? undefined : parsed;
    }
    return sumArrayField(data.items || data.lineItems, "total") || sumArrayField(data.items || data.lineItems, "lineTotal");
  },
});

computedFieldsService.register({
  key: "invoiceTax",
  compute: (context) => {
    if (!context.invoice?.data) {
      return undefined;
    }
    const data = context.invoice.data;
    const tax = data.vatTotal || data.taxTotal || data.vat || data.tax;
    if (typeof tax === "number") {
      return tax;
    }
    if (typeof tax === "string") {
      const parsed = parseFloat(tax);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  },
});

computedFieldsService.register({
  key: "invoiceTotal",
  compute: (context) => {
    if (!context.invoice?.data) {
      return undefined;
    }
    const data = context.invoice.data;
    const total = data.total || data.grossTotal || data.grandTotal;
    if (typeof total === "number") {
      return total;
    }
    if (typeof total === "string") {
      const parsed = parseFloat(total);
      return isNaN(parsed) ? undefined : parsed;
    }
    // Compute subtotal and tax directly to avoid infinite recursion
    const subtotal = computedFieldsService.computeField("invoiceSubtotal", context);
    const tax = computedFieldsService.computeField("invoiceTax", context);
    if (typeof subtotal === "number" && typeof tax === "number") {
      return subtotal + tax;
    }
    return undefined;
  },
});

computedFieldsService.register({
  key: "invoiceItemCount",
  compute: (context) => {
    if (!context.invoice?.data) {
      return undefined;
    }
    const data = context.invoice.data;
    const items = data.items || data.lineItems;
    if (Array.isArray(items)) {
      return items.length;
    }
    return 0;
  },
});

computedFieldsService.register({
  key: "customerFullName",
  compute: (context) => {
    if (!context.customer) {
      return undefined;
    }
    const parts: string[] = [];
    if (context.customer.firstName) {
      parts.push(context.customer.firstName);
    }
    if (context.customer.lastName) {
      parts.push(context.customer.lastName);
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
  },
});

function sumArrayField(
  items: DataContextValue | undefined,
  fieldName: string
): number | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }

  let sum = 0;
  for (const item of items) {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const value = (item as Record<string, DataContextValue>)[fieldName];
      if (typeof value === "number") {
        sum += value;
      } else if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          sum += parsed;
        }
      }
    }
  }

  return sum > 0 ? sum : undefined;
}

