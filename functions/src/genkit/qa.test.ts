import { test } from "node:test";
import assert from "node:assert";
import { templateDataSchema } from "../core/entities/template";
import { emailTemplateDataSchema } from "../core/entities/email-template";
import { evaluateEmailTemplateQa, evaluateInvoiceTemplateQa } from "./qa";

function makeTextElement(binding: string, text: string, index: number) {
  return {
    id: `text-${index}-${binding}`,
    type: "text" as const,
    x: 40,
    y: 40 + index * 24,
    width: 260,
    height: 20,
    text,
    binding,
    typography: {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: "normal" as const,
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#111827",
      align: "left" as const,
      uppercase: false,
      lowercase: false,
    },
  };
}

test("invoice QA fails when compliance bindings are missing", () => {
  const template = templateDataSchema.parse({
    orgId: "official",
    name: "Incomplete Invoice",
    pageSize: "A4",
    brand: {
      fonts: ["Inter"],
      colors: { primary: "#111827", secondary: "#6b7280", accent: "#2563eb" },
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    elements: [makeTextElement("invoiceNumber", "Invoice #", 1)],
    status: "draft",
  });

  const qa = evaluateInvoiceTemplateQa(template, "en");
  assert.ok(qa.score < 100);
  assert.ok(qa.errors.some((error) => error.includes("Missing EU required bindings")));
});

test("invoice QA passes for a basic EU-compatible invoice structure", () => {
  const requiredBindings = [
    "invoiceNumber",
    "invoiceDate",
    "supplier.name",
    "supplier.address",
    "supplier.vatId",
    "customer.name",
    "customer.address",
    "currency",
  ];

  const elements = requiredBindings.map((binding, index) =>
    makeTextElement(binding, binding.includes("supplier") ? "Доставчик" : "Клиент", index + 1),
  );

  elements.push({
    id: "items-table",
    type: "table",
    x: 40,
    y: 280,
    width: 714,
    height: 260,
    itemsBinding: "items",
    rowHeight: 28,
    headerHeight: 28,
    stripe: false,
    columns: [
      { id: "description", header: "Описание", binding: "description", type: "text", align: "left", width: "3fr" },
      { id: "quantity", header: "Количество", binding: "quantity", type: "number", align: "right", width: "1fr" },
      { id: "unitPrice", header: "Цена", binding: "unitPrice", type: "currency", align: "right", width: "1fr", currency: "EUR" },
      { id: "total", header: "Общо", binding: "total", type: "currency", align: "right", width: "1fr", currency: "EUR" },
    ],
  } as any);

  elements.push({
    id: "net-amount",
    type: "currency",
    x: 520,
    y: 570,
    width: 200,
    height: 24,
    binding: "netAmount",
    currency: "EUR",
    mode: "formula",
    formula: "=SUM(items[*].total)",
  } as any);

  elements.push({
    id: "vat-total",
    type: "currency",
    x: 520,
    y: 604,
    width: 200,
    height: 24,
    binding: "vatTotal",
    currency: "EUR",
    mode: "formula",
    formula: "=netAmount*0.2",
  } as any);

  elements.push({
    id: "gross-total",
    type: "currency",
    x: 520,
    y: 638,
    width: 200,
    height: 24,
    binding: "grossTotal",
    currency: "EUR",
    mode: "formula",
    formula: "=netAmount+vatTotal",
  } as any);

  const template = templateDataSchema.parse({
    orgId: "official",
    name: "EU Invoice",
    pageSize: "A4",
    brand: {
      fonts: ["Inter"],
      colors: { primary: "#111827", secondary: "#6b7280", accent: "#2563eb" },
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    elements,
    status: "draft",
    productTableConfig: {
      itemsBinding: "items",
      columnMappings: [
        {
          columnBinding: "description",
          productField: "description",
          transform: "none",
          lockOnProductSelect: true,
        },
        {
          columnBinding: "unitPrice",
          productField: "price",
          transform: "currency_convert",
          targetCurrency: "EUR",
          lockOnProductSelect: true,
        },
      ],
      autoQuantity: false,
      defaultQuantity: 1,
      autoConvertCurrency: true,
      defaultCurrency: "EUR",
    },
  });

  const qa = evaluateInvoiceTemplateQa(template, "bg");
  assert.ok(qa.score >= 85, `Expected score >= 85, got ${qa.score}`);
});

test("email QA validates context and placeholder usage", () => {
  const template = emailTemplateDataSchema.parse({
    orgId: "official",
    name: "Изпратена фактура",
    subject: "Фактура {{invoice.number}}",
    htmlContent: "<p>Здравейте {{contact.name}}, фактурата е готова.</p>",
    allowedContexts: ["invoice_send"],
    placeholders: [
      {
        key: "invoice.number",
        source: {
          type: "entity_field",
          entity: "invoice",
          path: "invoice.number",
        },
      },
      {
        key: "contact.name",
        source: {
          type: "entity_field",
          entity: "contact",
          path: "contact.name",
        },
      },
    ],
    status: "draft",
    version: 1,
    isSystemDefault: false,
    isLocked: false,
    blocks: [],
    designTokens: {},
  });

  const qa = evaluateEmailTemplateQa(template, "bg");
  assert.ok(qa.score >= 85, `Expected score >= 85, got ${qa.score}`);
});

test("email QA fails when template is not invoice-compatible", () => {
  const template = emailTemplateDataSchema.parse({
    orgId: "official",
    name: "Reminder",
    subject: "Proposal {{proposal.id}}",
    htmlContent: "<p>Hello {{contact.name}}</p>",
    allowedContexts: ["proposal_send"],
    placeholders: [
      {
        key: "proposal.id",
        source: {
          type: "entity_field",
          entity: "proposal",
          path: "proposal.id",
        },
      },
      {
        key: "contact.name",
        source: {
          type: "entity_field",
          entity: "contact",
          path: "contact.name",
        },
      },
    ],
    status: "draft",
    version: 1,
    isSystemDefault: false,
    isLocked: false,
    blocks: [],
    designTokens: {},
  });

  const qa = evaluateEmailTemplateQa(template, "en");
  assert.ok(qa.errors.some((error) => error.includes("not compatible with invoice_send")));
});
