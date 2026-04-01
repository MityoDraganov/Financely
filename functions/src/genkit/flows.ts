import z from "zod";
import { logger } from "firebase-functions";
import type { OfficialTemplateGenkit } from "./runtime";
import {
  officialTemplateBlueprintSchema,
  type OfficialTemplateBlueprint,
  invoiceGenerationSchema,
  emailGenerationSchema,
  officialTemplatePackFlowInputSchema,
  officialTemplatePackFlowOutputSchema,
  type InvoiceGenerationData,
  type EmailGenerationData,
  type OfficialTemplatePackFlowInput,
  type OfficialTemplatePackFlowOutput,
} from "./schemas";

const INVOICE_MODEL = "gemini-2.5-flash";
const EMAIL_MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const GENERATION_TIMEOUT_MS = 45_000;
const PACK_CONCURRENCY = 4;
const DEFAULT_BRAND = {
  fonts: ["Inter"],
  colors: {
    primary: "#111827",
    secondary: "#6b7280",
    accent: "#2563eb",
  },
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
};
const EU_REQUIRED_BINDINGS = [
  "invoiceNumber",
  "invoiceDate",
  "supplier.name",
  "supplier.address",
  "supplier.vatId",
  "customer.name",
  "customer.address",
  "items",
  "netAmount",
  "vatTotal",
  "grossTotal",
  "currency",
];

function resolveModel(modelName: string): unknown {
  try {
    const { googleAI } = require("@genkit-ai/google-genai") as { googleAI: any };
    if (googleAI && typeof googleAI.model === "function") {
      return googleAI.model(modelName);
    }
  } catch {
    // Testing and local typecheck environments may not have Genkit deps installed.
  }
  return modelName;
}

const invoiceFlowInputSchema = z.object({
  blueprint: officialTemplateBlueprintSchema,
});

const emailFlowInputSchema = z.object({
  blueprint: officialTemplateBlueprintSchema,
});

function getLanguageInstruction(language: "en" | "bg"): string {
  return language === "bg"
    ? "All visible template text must be in Bulgarian (Cyrillic)."
    : "All visible template text must be in English.";
}

function buildInvoicePrompt(blueprint: OfficialTemplateBlueprint, previousErrors?: string): string {
  return [
    "Generate an official marketplace invoice template for Financely.",
    "Region must be EU and template must satisfy EU compliance field bindings.",
    "Output must be valid JSON for the provided schema. Do not include markdown.",
    `Template archetype: ${blueprint.archetype}`,
    `Template title: ${blueprint.title}`,
    `Style: ${blueprint.style}`,
    getLanguageInstruction(blueprint.language),
    "Template must fit A4 canvas 794x1123 and keep all elements within bounds.",
    "Use Currency elements for monetary values and include productTableConfig.",
    blueprint.customPrompt ? `Additional instructions: ${blueprint.customPrompt}` : "",
    previousErrors ? `Previous validation errors to fix: ${previousErrors}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEmailPrompt(blueprint: OfficialTemplateBlueprint, previousErrors?: string): string {
  return [
    "Generate an official marketplace email template for Financely invoice workflows.",
    "Output must be valid JSON for the provided schema. Do not include markdown.",
    `Template archetype: ${blueprint.archetype}`,
    `Template title: ${blueprint.title}`,
    `Style: ${blueprint.style}`,
    getLanguageInstruction(blueprint.language),
    "Template must be compatible with invoice send context.",
    "Include subject, htmlContent, allowedContexts, placeholders and sections.",
    "Include placeholders for invoice and contact data that are actually used in content.",
    blueprint.customPrompt ? `Additional instructions: ${blueprint.customPrompt}` : "",
    previousErrors ? `Previous validation errors to fix: ${previousErrors}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksLikeJson) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function deepNormalizeJson(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return value;
  }
  const parsed = tryParseJsonString(value);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => deepNormalizeJson(item, depth + 1));
  }
  if (parsed && typeof parsed === "object") {
    const normalizedEntries = Object.entries(parsed as Record<string, unknown>).map(
      ([key, entryValue]) => [key, deepNormalizeJson(entryValue, depth + 1)] as const,
    );
    return Object.fromEntries(normalizedEntries);
  }
  return parsed;
}

function ensureObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeInvoiceCandidate(
  rawOutput: unknown,
  blueprint: OfficialTemplateBlueprint,
): unknown {
  const normalized = deepNormalizeJson(rawOutput);
  const objectValue = ensureObjectRecord(normalized);
  if (!objectValue) {
    return normalized;
  }

  const candidate: Record<string, unknown> = { ...objectValue };
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    candidate.name = blueprint.title;
  }
  if (
    candidate.pageSize !== "A4" &&
    candidate.pageSize !== "Letter" &&
    candidate.pageSize !== "Legal"
  ) {
    candidate.pageSize = "A4";
  }

  const brand = ensureObjectRecord(deepNormalizeJson(candidate.brand));
  const brandColors = ensureObjectRecord(brand?.colors);
  const brandMargins = ensureObjectRecord(brand?.margins);
  candidate.brand = {
    fonts: Array.isArray(brand?.fonts) ? brand?.fonts : DEFAULT_BRAND.fonts,
    colors: {
      primary:
        typeof brandColors?.primary === "string"
          ? brandColors.primary
          : DEFAULT_BRAND.colors.primary,
      secondary:
        typeof brandColors?.secondary === "string"
          ? brandColors.secondary
          : DEFAULT_BRAND.colors.secondary,
      accent:
        typeof brandColors?.accent === "string"
          ? brandColors.accent
          : DEFAULT_BRAND.colors.accent,
    },
    margins: {
      top:
        typeof brandMargins?.top === "number"
          ? brandMargins.top
          : DEFAULT_BRAND.margins.top,
      right:
        typeof brandMargins?.right === "number"
          ? brandMargins.right
          : DEFAULT_BRAND.margins.right,
      bottom:
        typeof brandMargins?.bottom === "number"
          ? brandMargins.bottom
          : DEFAULT_BRAND.margins.bottom,
      left:
        typeof brandMargins?.left === "number"
          ? brandMargins.left
          : DEFAULT_BRAND.margins.left,
    },
  };

  const normalizedElements = deepNormalizeJson(candidate.elements);
  const candidateElements = Array.isArray(normalizedElements)
    ? normalizedElements
        .map((item) => deepNormalizeJson(item))
        .filter((item) => !!item && typeof item === "object" && !Array.isArray(item))
    : [];

  const hasBinding = (binding: string) =>
    candidateElements.some((element) => {
      const el = element as Record<string, unknown>;
      if (typeof el.binding === "string" && el.binding === binding) {
        return true;
      }
      if (binding === "items" && typeof el.itemsBinding === "string" && el.itemsBinding === "items") {
        return true;
      }
      return false;
    });

  if (candidateElements.length === 0) {
    const isBg = blueprint.language === "bg";
    candidate.elements = [
      {
        id: "invoice-title",
        type: "text",
        x: 40,
        y: 40,
        width: 320,
        height: 28,
        text: isBg ? "Фактура" : "Invoice",
        typography: {
          fontFamily: "Inter",
          fontSize: 22,
          fontWeight: "bold",
          lineHeight: 1.2,
          letterSpacing: 0,
          color: "#111827",
          align: "left",
          uppercase: false,
          lowercase: false,
        },
      },
      { id: "invoice-number", type: "input", x: 40, y: 88, width: 260, height: 24, binding: "invoiceNumber" },
      { id: "invoice-date", type: "input", x: 320, y: 88, width: 200, height: 24, binding: "invoiceDate" },
      { id: "supplier-name", type: "input", x: 40, y: 132, width: 280, height: 24, binding: "supplier.name" },
      { id: "supplier-address", type: "input", x: 40, y: 162, width: 340, height: 24, binding: "supplier.address" },
      { id: "supplier-vat", type: "input", x: 40, y: 192, width: 260, height: 24, binding: "supplier.vatId" },
      { id: "customer-name", type: "input", x: 420, y: 132, width: 280, height: 24, binding: "customer.name" },
      { id: "customer-address", type: "input", x: 420, y: 162, width: 300, height: 24, binding: "customer.address" },
      {
        id: "items-table",
        type: "table",
        x: 40,
        y: 250,
        width: 714,
        height: 260,
        itemsBinding: "items",
        columns: [
          { id: "description", header: isBg ? "Описание" : "Description", binding: "description", type: "text", align: "left", width: "3fr" },
          { id: "quantity", header: isBg ? "Количество" : "Quantity", binding: "quantity", type: "number", align: "right", width: "1fr" },
          { id: "unitPrice", header: isBg ? "Ед. цена" : "Unit Price", binding: "unitPrice", type: "currency", align: "right", width: "1fr", currency: "EUR" },
          { id: "total", header: isBg ? "Общо" : "Total", binding: "total", type: "currency", align: "right", width: "1fr", currency: "EUR" },
        ],
      },
      { id: "currency-code", type: "input", x: 520, y: 532, width: 200, height: 24, binding: "currency" },
      { id: "net-amount", type: "currency", x: 520, y: 564, width: 200, height: 24, binding: "netAmount", currency: "EUR", mode: "formula", formula: "=SUM(items[*].total)" },
      { id: "vat-total", type: "currency", x: 520, y: 596, width: 200, height: 24, binding: "vatTotal", currency: "EUR", mode: "formula", formula: "=netAmount*0.2" },
      { id: "gross-total", type: "currency", x: 520, y: 628, width: 200, height: 24, binding: "grossTotal", currency: "EUR", mode: "formula", formula: "=netAmount+vatTotal" },
    ];
  } else {
    const missingRequired = EU_REQUIRED_BINDINGS.filter((binding) => !hasBinding(binding));
    let cursorY = 680;
    const extraElements: Array<Record<string, unknown>> = [];
    for (const binding of missingRequired) {
      if (binding === "items") {
        extraElements.push({
          id: "items-table-fallback",
          type: "table",
          x: 40,
          y: 250,
          width: 714,
          height: 240,
          itemsBinding: "items",
          columns: [
            { id: "description", header: "Description", binding: "description", type: "text", align: "left", width: "3fr" },
            { id: "quantity", header: "Quantity", binding: "quantity", type: "number", align: "right", width: "1fr" },
            { id: "unitPrice", header: "Unit Price", binding: "unitPrice", type: "currency", align: "right", width: "1fr", currency: "EUR" },
            { id: "total", header: "Total", binding: "total", type: "currency", align: "right", width: "1fr", currency: "EUR" },
          ],
        });
        continue;
      }
      if (binding === "netAmount" || binding === "vatTotal" || binding === "grossTotal") {
        const formula =
          binding === "netAmount"
            ? "=SUM(items[*].total)"
            : binding === "vatTotal"
            ? "=netAmount*0.2"
            : "=netAmount+vatTotal";
        extraElements.push({
          id: `${binding}-fallback`,
          type: "currency",
          x: 520,
          y: cursorY,
          width: 200,
          height: 24,
          binding,
          currency: "EUR",
          mode: "formula",
          formula,
        });
        cursorY += 30;
        continue;
      }
      extraElements.push({
        id: `${binding.replace(/\W+/g, "-")}-fallback`,
        type: "input",
        x: 40,
        y: cursorY,
        width: 300,
        height: 24,
        binding,
      });
      cursorY += 30;
    }
    candidate.elements = [...candidateElements, ...extraElements];
  }

  const productTableConfig = deepNormalizeJson(candidate.productTableConfig);
  if (productTableConfig && typeof productTableConfig === "object") {
    candidate.productTableConfig = productTableConfig;
  } else {
    candidate.productTableConfig = {
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
    };
  }

  return candidate;
}

function normalizeEmailCandidate(
  rawOutput: unknown,
  blueprint: OfficialTemplateBlueprint,
): unknown {
  const normalized = deepNormalizeJson(rawOutput);
  const objectValue = ensureObjectRecord(normalized);
  if (!objectValue) {
    return normalized;
  }

  const candidate: Record<string, unknown> = { ...objectValue };
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    candidate.name = blueprint.title;
  }
  if (typeof candidate.subject !== "string" || candidate.subject.trim().length === 0) {
    candidate.subject =
      blueprint.language === "bg"
        ? "Вашата фактура {{invoice.number}}"
        : "Your invoice {{invoice.number}}";
  }
  if (typeof candidate.htmlContent !== "string" || candidate.htmlContent.trim().length === 0) {
    candidate.htmlContent =
      blueprint.language === "bg"
        ? "<p>Здравейте {{contact.name}}, вашата фактура {{invoice.number}} е готова.</p>"
        : "<p>Hello {{contact.name}}, your invoice {{invoice.number}} is ready.</p>";
  }

  const normalizedBlocks = deepNormalizeJson(candidate.blocks);
  if (Array.isArray(normalizedBlocks)) {
    candidate.blocks = normalizedBlocks;
  } else if (normalizedBlocks && typeof normalizedBlocks === "object") {
    const blocksObject = normalizedBlocks as Record<string, unknown>;
    const headerBlocks = Array.isArray(blocksObject.header) ? blocksObject.header : [];
    const bodyBlocks = Array.isArray(blocksObject.body) ? blocksObject.body : [];
    const footerBlocks = Array.isArray(blocksObject.footer) ? blocksObject.footer : [];
    candidate.blocks = [...headerBlocks, ...bodyBlocks, ...footerBlocks];
    candidate.sections = {
      header: [],
      body: [],
      footer: [],
    };
  } else {
    candidate.blocks = [];
  }

  const normalizedAllowedContexts = deepNormalizeJson(candidate.allowedContexts);
  candidate.allowedContexts = Array.isArray(normalizedAllowedContexts)
    ? normalizedAllowedContexts
    : ["invoice_send"];

  const normalizedPlaceholders = deepNormalizeJson(candidate.placeholders);
  candidate.placeholders = Array.isArray(normalizedPlaceholders)
    ? normalizedPlaceholders
    : [];

  const normalizedSections = deepNormalizeJson(candidate.sections);
  if (normalizedSections && typeof normalizedSections === "object" && !Array.isArray(normalizedSections)) {
    const sections = normalizedSections as Record<string, unknown>;
    candidate.sections = {
      header: Array.isArray(sections.header) ? sections.header : [],
      body: Array.isArray(sections.body) ? sections.body : [],
      footer: Array.isArray(sections.footer) ? sections.footer : [],
    };
  } else {
    candidate.sections = {
      header: [],
      body: [],
      footer: [],
    };
  }

  return candidate;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        continue;
      }
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function generateInvoiceWithRetries(
  ai: OfficialTemplateGenkit,
  blueprint: OfficialTemplateBlueprint,
): Promise<InvoiceGenerationData> {
  let validationErrors = "";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { output } = await withTimeout(
        ai.generate({
          model: resolveModel(INVOICE_MODEL),
          prompt: buildInvoicePrompt(blueprint, validationErrors),
          output: { schema: invoiceGenerationSchema },
        }),
        GENERATION_TIMEOUT_MS,
        `Invoice generation attempt ${attempt}`,
      );

      const parsed = invoiceGenerationSchema.safeParse(
        normalizeInvoiceCandidate(output, blueprint),
      );
      if (parsed.success) {
        return parsed.data;
      }

      validationErrors = parsed.error.message;
      lastError = new Error(parsed.error.message);
      logger.warn("Invoice generation output failed schema validation", {
        blueprintId: blueprint.id,
        attempt,
        errors: parsed.error.issues.map((issue) => issue.message),
        outputType: typeof output,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;
      validationErrors = normalizedError.message;
      logger.warn("Invoice generation attempt failed", {
        blueprintId: blueprint.id,
        attempt,
        error: normalizedError.message,
      });
    }
  }

  throw new Error(
    `Failed to generate invoice template after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
  );
}

async function generateEmailWithRetries(
  ai: OfficialTemplateGenkit,
  blueprint: OfficialTemplateBlueprint,
): Promise<EmailGenerationData> {
  let validationErrors = "";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { output } = await withTimeout(
        ai.generate({
          model: resolveModel(EMAIL_MODEL),
          prompt: buildEmailPrompt(blueprint, validationErrors),
          output: { schema: emailGenerationSchema },
        }),
        GENERATION_TIMEOUT_MS,
        `Email generation attempt ${attempt}`,
      );

      const parsed = emailGenerationSchema.safeParse(
        normalizeEmailCandidate(output, blueprint),
      );
      if (parsed.success) {
        return parsed.data;
      }

      validationErrors = parsed.error.message;
      lastError = new Error(parsed.error.message);
      logger.warn("Email generation output failed schema validation", {
        blueprintId: blueprint.id,
        attempt,
        errors: parsed.error.issues.map((issue) => issue.message),
        outputType: typeof output,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;
      validationErrors = normalizedError.message;
      logger.warn("Email generation attempt failed", {
        blueprintId: blueprint.id,
        attempt,
        error: normalizedError.message,
      });
    }
  }

  throw new Error(
    `Failed to generate email template after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
  );
}

export function buildOfficialTemplateFlows(ai: OfficialTemplateGenkit) {
  const generateOfficialInvoiceTemplateFlow = ai.defineFlow(
    {
      name: "generateOfficialInvoiceTemplateFlow",
      inputSchema: invoiceFlowInputSchema,
      outputSchema: invoiceGenerationSchema,
    },
    async (input: z.infer<typeof invoiceFlowInputSchema>) => {
      const { blueprint } = input;
      if (blueprint.type !== "invoice") {
        throw new Error(`Invoice flow received non-invoice blueprint: ${blueprint.type}`);
      }
      return generateInvoiceWithRetries(ai, blueprint);
    },
  );

  const generateOfficialEmailTemplateFlow = ai.defineFlow(
    {
      name: "generateOfficialEmailTemplateFlow",
      inputSchema: emailFlowInputSchema,
      outputSchema: emailGenerationSchema,
    },
    async (input: z.infer<typeof emailFlowInputSchema>) => {
      const { blueprint } = input;
      if (blueprint.type !== "email") {
        throw new Error(`Email flow received non-email blueprint: ${blueprint.type}`);
      }
      return generateEmailWithRetries(ai, blueprint);
    },
  );

  const generateOfficialTemplatePackFlow = ai.defineFlow(
    {
      name: "generateOfficialTemplatePackFlow",
      inputSchema: officialTemplatePackFlowInputSchema,
      outputSchema: officialTemplatePackFlowOutputSchema,
    },
    async (input: OfficialTemplatePackFlowInput): Promise<OfficialTemplatePackFlowOutput> => {
      const parsedInput = officialTemplatePackFlowInputSchema.parse(input);
      const results: OfficialTemplatePackFlowOutput["results"] = [];

      await runWithConcurrency(parsedInput.blueprints, PACK_CONCURRENCY, async (blueprint) => {
        try {
          if (blueprint.type === "invoice") {
            const template = await generateOfficialInvoiceTemplateFlow({
              blueprint,
            });

            results.push({
              blueprintId: blueprint.id,
              type: "invoice",
              language: blueprint.language,
              status: "ok",
              templateContent: template as Record<string, unknown>,
              errors: [],
            });
          } else {
            const template = await generateOfficialEmailTemplateFlow({
              blueprint,
            });

            results.push({
              blueprintId: blueprint.id,
              type: "email",
              language: blueprint.language,
              status: "ok",
              templateContent: template as Record<string, unknown>,
              errors: [],
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            blueprintId: blueprint.id,
            type: blueprint.type,
            language: blueprint.language,
            status: "failed",
            errors: [message],
          });
        }
      });

      return officialTemplatePackFlowOutputSchema.parse({ results });
    },
  );

  return {
    generateOfficialInvoiceTemplateFlow,
    generateOfficialEmailTemplateFlow,
    generateOfficialTemplatePackFlow,
  };
}
