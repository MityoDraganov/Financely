import z from "zod";
import { baseEntitySchema } from "./base";
import { templateDataSchema } from "./template";

/**
 * Dynamic invoice data schema.
 *
 * Invoices are based on templates and can have completely different structures.
 * The `data` field stores dynamic key-value pairs that correspond to template bindings.
 *
 * Examples of bindings in templates:
 * - "seller.name" -> data.seller.name
 * - "invoiceNumber" -> data.invoiceNumber
 * - "items" (table) -> data.items = [{...}, {...}]
 *
 * Tables are stored as arrays of objects where each object represents a row.
 */

// Generic data value that can be a primitive, object, or array (for tables)
// Using z.lazy to handle recursive schema
const invoiceDataValueSchema: z.ZodType<InvoiceDataValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), invoiceDataValueSchema),
    z.array(z.record(z.string(), invoiceDataValueSchema)),
  ])
);

// Type for invoice data values
export type InvoiceDataValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: InvoiceDataValue }
  | Array<{ [key: string]: InvoiceDataValue }>;

export const INVOICE_STATUSES = {
  UNSENT: "unsent",
  SENT: "sent",
  PAID: "paid",
  CANCELLED: "cancelled",
} as const;

export const LEGACY_INVOICE_STATUSES = {
  DRAFT: "draft",
} as const;

export type InvoiceCanonicalStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];
export type InvoiceStatus = InvoiceCanonicalStatus | typeof LEGACY_INVOICE_STATUSES.DRAFT;

export const normalizeInvoiceStatus = (status: string | undefined | null): InvoiceCanonicalStatus => {
  if (!status || status === LEGACY_INVOICE_STATUSES.DRAFT) {
    return INVOICE_STATUSES.UNSENT;
  }
  if (Object.values(INVOICE_STATUSES).includes(status as InvoiceCanonicalStatus)) {
    return status as InvoiceCanonicalStatus;
  }
  return INVOICE_STATUSES.UNSENT;
};

export const invoiceDeliveryEventSchema = z.object({
  method: z.enum(["email", "manual", "other"]).default("email"),
  channel: z.string().optional(),
  recipient: z.string().optional(),
  sentAt: z.string(),
  sentByUserId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const invoiceDataSchema = z.object({
  // Organization ID for multi-tenancy
  orgId: z.string().min(1),

  // Reference to the template this invoice is based on
  templateId: z.string().min(1),

  // Optional reference to a specific template version
  templateVersionId: z.string().optional(),

  // Frozen template snapshot used for rendering this invoice forever
  templateSnapshot: templateDataSchema.optional(),

  // Dynamic data that matches template bindings
  // Structure depends entirely on the template's element bindings
  // Example structure:
  // {
  //   seller: { name: "...", address: "...", taxIdVat: "..." },
  //   buyer: { name: "...", address: "...", taxIdVat: "..." },
  //   invoiceNumber: "INV-001",
  //   issueDate: "2025-01-01",
  //   dueDate: "2025-01-31",
  //   items: [
  //     { description: "Item 1", qty: 1, unitPrice: 100 },
  //     { description: "Item 2", qty: 2, unitPrice: 50 }
  //   ],
  //   subtotal: 200,
  //   vatTotal: 40,
  //   total: 240,
  //   customField: "Custom value",
  //   ...
  // }
  data: z.record(z.string(), invoiceDataValueSchema),

  // Invoice status
  status: z
    .union([
      z.nativeEnum(INVOICE_STATUSES),
      z.literal(LEGACY_INVOICE_STATUSES.DRAFT),
    ])
    .default(INVOICE_STATUSES.UNSENT),
  deliveryHistory: z.array(invoiceDeliveryEventSchema).optional(),
  paidAt: z.string().optional(),

  // Optional metadata
  notes: z.string().optional(),
  pdfUrl: z.string().optional(),
});

export type InvoiceData = z.infer<typeof invoiceDataSchema>;
export type InvoiceDeliveryEvent = z.infer<typeof invoiceDeliveryEventSchema>;

export const invoiceSchema = baseEntitySchema.merge(invoiceDataSchema);
export type Invoice = z.infer<typeof invoiceSchema>;

/**
 * Helper type for creating invoices with partial data.
 * Omits server-managed fields like id, createdAt, updatedAt.
 */
export type CreateInvoiceInput = Omit<InvoiceData, "status" | "pdfUrl"> & {
  status?: InvoiceData["status"];
};

/**
 * Helper function to validate that invoice data matches expected template bindings.
 * This can be used to ensure data integrity before saving.
 *
 * @param {Record<string, InvoiceDataValue>} data - The invoice data to validate
 * @param {string[]} requiredBindings - Array of required binding paths (e.g., ["seller.name", "invoiceNumber"])
 * @return {object} Object indicating if all required bindings exist
 */
export function validateInvoiceBindings(
  data: Record<string, InvoiceDataValue>,
  requiredBindings: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const binding of requiredBindings) {
    const parts = binding.split(".");
    let current: InvoiceDataValue = data;

    for (const part of parts) {
      if (current == null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
        missing.push(binding);
        break;
      }
      current = current[part];
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Helper function to get a value from invoice data using a binding path.
 *
 * @param {Record<string, InvoiceDataValue>} data - The invoice data
 * @param {string} binding - Dot-notation path (e.g., "seller.name", "items")
 * @return {InvoiceDataValue | undefined} The value at the binding path, or undefined if not found
 */
export function getBindingValue(
  data: Record<string, InvoiceDataValue>,
  binding: string
): InvoiceDataValue | undefined {
  const parts = binding.split(".");
  let current: InvoiceDataValue = data;

  for (const part of parts) {
    if (current == null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Helper function to set a value in invoice data using a binding path.
 * Creates nested objects as needed.
 *
 * @param {Record<string, InvoiceDataValue>} data - The invoice data (will be mutated)
 * @param {string} binding - Dot-notation path (e.g., "seller.name")
 * @param {InvoiceDataValue} value - The value to set
 * @return {void}
 */
export function setBindingValue(
  data: Record<string, InvoiceDataValue>,
  binding: string,
  value: InvoiceDataValue
): void {
  const parts = binding.split(".");
  let current: Record<string, InvoiceDataValue> = data;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];

    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, InvoiceDataValue>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Helper function to check if invoice data is compliant with a region's requirements.
 * This is a convenience wrapper around the compliance validation utilities.
 * 
 * @param data - The invoice data to check
 * @param region - The compliance region (e.g., "US", "EU")
 * @returns true if compliant, false otherwise
 */
export function isInvoiceCompliant(
  data: Record<string, InvoiceDataValue>,
  region: "US" | "EU" | "CA" | "AU" | "UK"
): boolean {
  // Import dynamically to avoid circular dependencies
  const { validateInvoiceCompliance } = require("../utils/invoice-compliance");
  const result = validateInvoiceCompliance(data, region);
  return result.valid;
}
