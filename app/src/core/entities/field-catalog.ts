import type { InvoiceRegion } from "./invoice-compliance";

export type FieldGroup =
  | "Invoice Info"
  | "Seller"
  | "Customer"
  | "Items"
  | "Totals"
  | "Tax"
  | "Payment"
  | "Custom";

export type FieldFormat =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "array"
  | "object";

export type FieldDefinition = {
  id: string;
  label: string;
  description?: string;
  group: FieldGroup;
  format: FieldFormat;
  aliases?: string[];
  compliance: {
    requiredIn?: InvoiceRegion[];
    optionalIn?: InvoiceRegion[];
  };
  suggestedElementType: "text" | "input" | "table" | "currency";
  itemFields?: string[];
};

export const FIELD_CATALOG: FieldDefinition[] = [
  // ── Invoice Info ──────────────────────────────────────────────────────────
  {
    id: "invoiceNumber",
    label: "Invoice Number",
    description: "Unique sequential invoice identifier",
    group: "Invoice Info",
    format: "string",
    aliases: ["invoice_number", "invoiceNo"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "invoiceDate",
    label: "Invoice Date",
    description: "Date the invoice was issued",
    group: "Invoice Info",
    format: "date",
    aliases: ["date", "issued_date"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "input",
  },
  {
    id: "dueDate",
    label: "Due Date",
    group: "Invoice Info",
    format: "date",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "input",
  },
  {
    id: "supplyDate",
    label: "Supply Date",
    description: "Date goods/services were supplied (if different from invoice date)",
    group: "Invoice Info",
    format: "date",
    compliance: { optionalIn: ["EU", "UK"] },
    suggestedElementType: "input",
  },
  {
    id: "currency",
    label: "Currency",
    description: "ISO currency code (e.g., EUR, USD)",
    group: "Invoice Info",
    format: "string",
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "text",
  },
  {
    id: "notes",
    label: "Notes",
    group: "Invoice Info",
    format: "string",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },

  // ── Seller ────────────────────────────────────────────────────────────────
  {
    id: "seller.name",
    label: "Seller Name",
    description: "Legal name of the seller / supplier",
    group: "Seller",
    format: "string",
    aliases: ["supplier.name", "vendor.name"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "seller.address",
    label: "Seller Address",
    group: "Seller",
    format: "object",
    aliases: ["supplier.address"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "seller.vatId",
    label: "Seller VAT ID",
    description: "VAT identification number (mandatory for EU/UK cross-border)",
    group: "Seller",
    format: "string",
    aliases: ["supplier.vatId", "supplier.vat_id", "seller.vat"],
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "text",
  },
  {
    id: "seller.taxId",
    label: "Seller Tax ID",
    description: "EIN or other national tax identifier",
    group: "Seller",
    format: "string",
    aliases: ["seller.ein", "taxId"],
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "seller.email",
    label: "Seller Email",
    group: "Seller",
    format: "string",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },

  // ── Customer ──────────────────────────────────────────────────────────────
  {
    id: "customer.name",
    label: "Customer Name",
    group: "Customer",
    format: "string",
    aliases: ["client.name", "buyer.name"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "customer.address",
    label: "Customer Address",
    group: "Customer",
    format: "object",
    aliases: ["client.address"],
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "text",
  },
  {
    id: "customer.vatId",
    label: "Customer VAT ID",
    group: "Customer",
    format: "string",
    compliance: { optionalIn: ["EU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "customer.email",
    label: "Customer Email",
    group: "Customer",
    format: "string",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },

  // ── Items ─────────────────────────────────────────────────────────────────
  {
    id: "items",
    label: "Line Items",
    description: "Invoice line items table",
    group: "Items",
    format: "array",
    aliases: ["lineItems", "invoice_items", "lines"],
    compliance: { requiredIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "table",
    itemFields: ["description", "quantity", "unitPrice", "total"],
  },

  // ── Totals ────────────────────────────────────────────────────────────────
  {
    id: "total",
    label: "Total Amount",
    group: "Totals",
    format: "number",
    aliases: ["amount", "totalAmount"],
    compliance: { requiredIn: ["US", "CA", "AU"], optionalIn: ["EU", "UK"] },
    suggestedElementType: "currency",
  },
  {
    id: "netAmount",
    label: "Net Amount",
    description: "Amount before tax (EU/UK required)",
    group: "Totals",
    format: "number",
    aliases: ["net", "subtotalNet"],
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "currency",
  },
  {
    id: "vatTotal",
    label: "Total VAT",
    group: "Totals",
    format: "number",
    aliases: ["vat", "totalVat"],
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "currency",
  },
  {
    id: "grossTotal",
    label: "Gross Total",
    description: "Net amount + VAT",
    group: "Totals",
    format: "number",
    aliases: ["gross", "totalGross"],
    compliance: { requiredIn: ["EU", "UK"], optionalIn: ["US", "CA", "AU"] },
    suggestedElementType: "currency",
  },
  {
    id: "subtotal",
    label: "Subtotal",
    group: "Totals",
    format: "number",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "currency",
  },

  // ── Tax ───────────────────────────────────────────────────────────────────
  {
    id: "taxRate",
    label: "Tax Rate",
    group: "Tax",
    format: "number",
    aliases: ["tax_rate"],
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "input",
  },
  {
    id: "taxAmount",
    label: "Tax Amount",
    group: "Tax",
    format: "number",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "currency",
  },
  {
    id: "reverseCharge",
    label: "Reverse Charge",
    description: "VAT reverse charge applies",
    group: "Tax",
    format: "boolean",
    compliance: { optionalIn: ["EU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "reverseChargeNote",
    label: "Reverse Charge Note",
    group: "Tax",
    format: "string",
    compliance: { optionalIn: ["EU", "UK"] },
    suggestedElementType: "text",
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  {
    id: "bankAccount.iban",
    label: "IBAN",
    group: "Payment",
    format: "string",
    aliases: ["iban"],
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "bankAccount.swift",
    label: "SWIFT / BIC",
    group: "Payment",
    format: "string",
    aliases: ["swift", "bic"],
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
  {
    id: "paymentTerms",
    label: "Payment Terms",
    group: "Payment",
    format: "string",
    compliance: { optionalIn: ["US", "EU", "CA", "AU", "UK"] },
    suggestedElementType: "text",
  },
];

export function getCatalogField(id: string): FieldDefinition | undefined {
  return FIELD_CATALOG.find((f) => f.id === id);
}

export function getCatalogFieldsByGroup(group: FieldGroup): FieldDefinition[] {
  return FIELD_CATALOG.filter((f) => f.group === group);
}

export function getRequiredCatalogFields(region: InvoiceRegion): FieldDefinition[] {
  return FIELD_CATALOG.filter((f) => f.compliance.requiredIn?.includes(region));
}
