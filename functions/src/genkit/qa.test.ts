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

function makeCompliantInvoiceTemplate(options?: {
  language?: "en" | "bg";
  accent?: string;
  fonts?: string[];
  includeDecorative?: boolean;
  englishHeavyDescription?: boolean;
  forceEnglishLabels?: boolean;
}) {
  const language = options?.language ?? "en";
  const useEnglishLabels = options?.forceEnglishLabels || language === "en";
  const labels = useEnglishLabels
    ? {
        invoiceNumber: "Invoice Number",
        invoiceDate: "Invoice Date",
        supplierName: "Supplier",
        supplierAddress: "Supplier Address",
        supplierVatId: "Supplier VAT ID",
        customerName: "Customer",
        customerAddress: "Customer Address",
        currency: "Currency",
        netAmount: "Net Amount",
        vatTotal: "VAT Total",
        grossTotal: "Gross Total",
      }
    : {
        invoiceNumber: "Номер на фактура",
        invoiceDate: "Дата на фактура",
        supplierName: "Доставчик",
        supplierAddress: "Адрес на доставчик",
        supplierVatId: "ДДС номер на доставчик",
        customerName: "Клиент",
        customerAddress: "Адрес на клиент",
        currency: "Валута",
        netAmount: "Нетна сума",
        vatTotal: "ДДС общо",
        grossTotal: "Крайна сума",
      };

  const tableHeaders = useEnglishLabels
    ? {
        description: "Description",
        quantity: "Quantity",
        unitPrice: "Unit Price",
        total: "Total",
      }
    : {
        description: "Описание",
        quantity: "Количество",
        unitPrice: "Ед. цена",
        total: "Общо",
      };

  const description = options?.englishHeavyDescription
    ? "Invoice due date and supplier/customer payment amount details. Description quantity total VAT amount due date invoice supplier customer."
    : language === "bg"
    ? "Професионална EU фактура за услуги."
    : "Professional EU service invoice.";

  const elements: any[] = [];

  if (options?.includeDecorative !== false) {
    elements.push({
      id: "decorative-box",
      type: "box",
      x: 32,
      y: 28,
      width: 730,
      height: 78,
      fill: "#f8fafc",
      stroke: options?.accent || "#0ea5e9",
      strokeWidth: 1,
      radius: 8,
    });
    elements.push({
      id: "decorative-line",
      type: "line",
      x: 40,
      y: 108,
      x2: 754,
      y2: 108,
      stroke: options?.accent || "#0ea5e9",
      strokeWidth: 2,
      width: 714,
      height: 1,
    });
  }

  const addLabelAndInput = (idPrefix: string, label: string, binding: string, x: number, y: number) => {
    elements.push(makeTextElement(`${idPrefix}-label`, label, elements.length + 1));
    elements[elements.length - 1].x = x;
    elements[elements.length - 1].y = y;
    elements.push({
      id: `${idPrefix}-input`,
      type: "input",
      x,
      y: y + 18,
      width: 280,
      height: 24,
      binding,
      variant: binding.toLowerCase().includes("date") ? "date" : "text",
      placeholder: "",
    });
  };

  addLabelAndInput("invoice-number", labels.invoiceNumber, "invoiceNumber", 56, 128);
  addLabelAndInput("invoice-date", labels.invoiceDate, "invoiceDate", 360, 128);
  addLabelAndInput("supplier-name", labels.supplierName, "supplier.name", 56, 190);
  addLabelAndInput("supplier-address", labels.supplierAddress, "supplier.address", 56, 246);
  addLabelAndInput("supplier-vat", labels.supplierVatId, "supplier.vatId", 56, 302);
  addLabelAndInput("customer-name", labels.customerName, "customer.name", 420, 190);
  addLabelAndInput("customer-address", labels.customerAddress, "customer.address", 420, 246);

  elements.push({
    id: "items-table",
    type: "table",
    x: 40,
    y: 370,
    width: 714,
    height: 220,
    itemsBinding: "items",
    rowHeight: 28,
    headerHeight: 32,
    stripe: true,
    columns: [
      { id: "description", header: tableHeaders.description, binding: "description", type: "text", align: "left", width: "3fr" },
      { id: "quantity", header: tableHeaders.quantity, binding: "quantity", type: "number", align: "right", width: "1fr" },
      { id: "unitPrice", header: tableHeaders.unitPrice, binding: "unitPrice", type: "currency", align: "right", width: "1fr", currency: "EUR" },
      { id: "total", header: tableHeaders.total, binding: "total", type: "currency", align: "right", width: "1fr", currency: "EUR" },
    ],
  });

  addLabelAndInput("currency", labels.currency, "currency", 520, 610);
  elements.push({
    id: "net-label",
    type: "text",
    x: 520,
    y: 664,
    width: 180,
    height: 20,
    text: labels.netAmount,
    typography: {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: "normal",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#334155",
      align: "left",
      uppercase: false,
      lowercase: false,
    },
  });
  elements.push({
    id: "net-amount",
    type: "currency",
    x: 520,
    y: 684,
    width: 200,
    height: 24,
    binding: "netAmount",
    currency: "EUR",
    mode: "formula",
    formula: "=SUM(items[*].total)",
    align: "right",
  });
  elements.push({
    id: "vat-label",
    type: "text",
    x: 520,
    y: 718,
    width: 180,
    height: 20,
    text: labels.vatTotal,
    typography: {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: "normal",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#334155",
      align: "left",
      uppercase: false,
      lowercase: false,
    },
  });
  elements.push({
    id: "vat-total",
    type: "currency",
    x: 520,
    y: 738,
    width: 200,
    height: 24,
    binding: "vatTotal",
    currency: "EUR",
    mode: "formula",
    formula: "=netAmount*0.2",
    align: "right",
  });
  elements.push({
    id: "gross-label",
    type: "text",
    x: 520,
    y: 772,
    width: 180,
    height: 20,
    text: labels.grossTotal,
    typography: {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: "normal",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#334155",
      align: "left",
      uppercase: false,
      lowercase: false,
    },
  });
  elements.push({
    id: "gross-total",
    type: "currency",
    x: 520,
    y: 792,
    width: 200,
    height: 24,
    binding: "grossTotal",
    currency: "EUR",
    mode: "formula",
    formula: "=netAmount+vatTotal",
    align: "right",
  });

  return templateDataSchema.parse({
    orgId: "official",
    name: useEnglishLabels ? "Invoice" : "Фактура",
    description,
    pageSize: "A4",
    brand: {
      fonts: options?.fonts || ["IBM Plex Sans", "Inter"],
      colors: { primary: "#111827", secondary: "#6b7280", accent: options?.accent || "#0ea5e9" },
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

test("invoice QA hard fails when key binding fields do not have labels", () => {
  const template = makeCompliantInvoiceTemplate({ language: "en" });
  const mutated = templateDataSchema.parse({
    ...template,
    elements: template.elements.filter((element) =>
      !(element.type === "text" && typeof element.text === "string" && element.text.includes("Invoice Number")),
    ),
  });

  const qa = evaluateInvoiceTemplateQa(mutated, "en");
  assert.strictEqual(qa.checks.keyFieldsHaveLabels, false);
  assert.ok(qa.errors.some((error) => error.includes("keyFieldsHaveLabels")));
});

test("invoice QA validates style profile conformity", () => {
  const template = makeCompliantInvoiceTemplate({
    language: "en",
    accent: "#0ea5e9",
    fonts: ["IBM Plex Sans", "Inter"],
    includeDecorative: true,
  });
  const qa = evaluateInvoiceTemplateQa(template, "en", "invoice-style-service-professional");
  assert.strictEqual(qa.checks.matchesStyleProfile, true);
  assert.ok(!qa.errors.some((error) => error.includes("matchesStyleProfile")));
});

test("invoice QA fails style profile check for mismatched style", () => {
  const template = makeCompliantInvoiceTemplate({
    language: "en",
    accent: "#ef4444",
    fonts: ["Inter"],
    includeDecorative: false,
  });
  const qa = evaluateInvoiceTemplateQa(template, "en", "invoice-style-service-professional");
  assert.strictEqual(qa.checks.matchesStyleProfile, false);
  assert.ok(qa.errors.some((error) => error.includes("matchesStyleProfile")));
});

test("invoice BG localization emits warnings for mixed language but does not hard fail", () => {
  const template = makeCompliantInvoiceTemplate({
    language: "bg",
    englishHeavyDescription: true,
  });
  const qa = evaluateInvoiceTemplateQa(template, "bg");
  assert.strictEqual(qa.checks.passesLocalization, true);
  assert.ok(qa.warnings.length > 0);
});

test("invoice BG localization hard fails on severe wrong-language output", () => {
  const template = makeCompliantInvoiceTemplate({
    language: "bg",
    forceEnglishLabels: true,
    englishHeavyDescription: true,
  });
  const qa = evaluateInvoiceTemplateQa(template, "bg");
  assert.strictEqual(qa.checks.passesLocalization, false);
  assert.ok(qa.errors.some((error) => error.includes("passesLocalization")));
});
