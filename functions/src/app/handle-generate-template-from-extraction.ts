import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { type InvoiceBlock, type TemplateData, templateDataSchema } from "../core/entities/template";
import { loggerService } from "../services/logger-service";
import { DEFAULT_TEMPLATE_QUALITY, type TemplateQuality } from "../services/invoice-extraction/pipeline-types";
import { getAIService, type JSONSchema } from "../services/ai/ai-service";
import { compileInvoiceBlocksToElements } from "../services/template-compiler/invoice-block-compiler";

export type GenerateTemplateFromExtractionResult = {
  template: TemplateData;
  quality: TemplateQuality;
  needsReview: boolean;
  reviewReasons: string[];
};

/**
 * Application handler for generating an invoice template from extracted invoice data.
 * Supports editedData override and returns quality/review metadata for UI gating.
 */
export async function handleGenerateTemplateFromExtraction(
  jobId: string,
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    templateName?: string;
    strategy?: "layout_fusion_v2" | "legacy";
    qualityTarget?: "pixel";
  },
  editedData?: Record<string, unknown>
): Promise<GenerateTemplateFromExtractionResult> {
  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);

  const job = await extractionJobRepository.get({ id: jobId });
  if (!job) {
    throw new Error(`Extraction job not found: ${jobId}`);
  }

  const workingJob = job;

  if (
    !editedData &&
    workingJob.generatedTemplate &&
    typeof workingJob.generatedTemplate === "object" &&
    Array.isArray((workingJob.generatedTemplate as Record<string, unknown>).elements)
  ) {
    loggerService.info("Returning cached generatedTemplate from job", { jobId });
    return {
      template: workingJob.generatedTemplate as unknown as TemplateData,
      quality: (workingJob.quality as TemplateQuality | undefined) || DEFAULT_TEMPLATE_QUALITY,
      needsReview: Boolean(workingJob.needsReview),
      reviewReasons: workingJob.reviewReasons || [],
    };
  }

  const aiService = getAIService();
  const startMs = Date.now();
  const image = await fetchFileAsInlineData(workingJob.fileUrl, workingJob.fileType);

  loggerService.info("Generating template from invoice file (one-shot vision)", {
    jobId,
    orgId: workingJob.orgId,
    fileType: workingJob.fileType,
    strategy: options?.strategy || null,
    qualityTarget: options?.qualityTarget || null,
  });

  const prompt = buildOneShotVisionPrompt({
    fileName: workingJob.fileName,
    style: options?.style,
    editedData,
  });

  const raw = await aiService.generateJSONWithImage<Record<string, unknown>>(
    image,
    prompt,
    ONE_SHOT_VISION_SCHEMA,
    {
      temperature: 0.1,
      maxTokens: 16384,
    }
  );

  const template = buildTemplateFromVisionResult({
    orgId: workingJob.orgId,
    fileName: workingJob.fileName,
    templateName: options?.templateName,
    raw,
  });

  const quality = estimateQualityFromTemplate(template);
  const reviewReasons = buildReviewReasons(template, raw);
  const needsReview = reviewReasons.length > 0;

  await extractionJobRepository.update({
    id: jobId,
    data: {
      ...(editedData && Object.keys(editedData).length > 0 ? { correctedData: editedData } : {}),
      generatedTemplate: template as unknown as Record<string, unknown>,
      aiModel: "gemini",
      quality,
      needsReview,
      reviewReasons,
      status: "validated",
      processingDurationMs: Date.now() - startMs,
    },
  });

  return { template, quality, needsReview, reviewReasons };
}

const ONE_SHOT_VISION_SCHEMA: JSONSchema = {
  type: "object",
  required: ["globalStyles", "blocks"],
  properties: {
    globalStyles: {
      type: "object",
      properties: {
        fontFamily: { type: "string" },
        primaryColor: { type: "string" },
        backgroundColor: { type: "string" },
      },
    },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          style: { type: "object" },
          content: { type: "object" },
          columns: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const ONE_SHOT_VISION_SYSTEM_PROMPT = `
You are an expert Frontend Engineer and UI Designer specialized in cloning invoice layouts.
Your goal is to convert the attached invoice image or PDF into a structured JSON template that matches the visual style as closely as possible.

INSTRUCTIONS
1. Analyze the visual hierarchy:
- Header: detect logo placement (left, right, center), invoice title size and weight.
- Colors: detect the primary brand color and return the nearest HEX.
- Table structure: detect vertical borders, horizontal borders, striping, and header background.
- Typography: detect serif vs sans-serif, relative sizing, and bold emphasis for totals.

2. Extraction strategy:
- Do not only extract text, extract visual relationships.
- If totals are bottom-right, align totals to right.
- If table header uses colored background or colored text, represent it explicitly.

3. Output schema:
Return STRICT JSON only in this shape:
{
  "globalStyles": {
    "fontFamily": "sans-serif" | "serif",
    "primaryColor": "#HEX",
    "backgroundColor": "#HEX"
  },
  "blocks": [
    {
      "type": "header",
      "style": {
        "alignment": "left" | "right" | "center",
        "logoSize": "small" | "medium" | "large",
        "fontSize": "small" | "medium" | "large",
        "hexColor": "#HEX"
      },
      "content": {
        "title": "INVOICE",
        "subtitle": "optional"
      }
    },
    {
      "type": "line_items_table",
      "style": {
        "hasVerticalBorders": boolean,
        "hasHorizontalBorders": boolean,
        "headerBackgroundColor": "#HEX",
        "headerTextColor": "#HEX",
        "rowStriping": boolean,
        "borderStyle": "none" | "rows" | "columns" | "all"
      },
      "columns": ["Item", "Qty", "Price", "Total"]
    },
    {
      "type": "totals_section",
      "style": {
        "alignment": "left" | "right" | "center",
        "fontSize": "small" | "medium" | "large",
        "isBold": true | false,
        "hexColor": "#HEX"
      }
    },
    {
      "type": "footer",
      "style": {
        "alignment": "left" | "right" | "center",
        "fontSize": "small" | "medium" | "large",
        "hexColor": "#HEX"
      },
      "content": {
        "text": "optional"
      }
    }
  ]
}

CRITICAL RULES
- If a table has no borders, explicitly set hasVerticalBorders and hasHorizontalBorders to false.
- Do not hallucinate columns that do not exist.
- Return JSON only. No markdown. No explanation.
`;

function buildOneShotVisionPrompt(input: {
  fileName: string;
  style?: "modern" | "classic" | "minimal" | "professional";
  editedData?: Record<string, unknown>;
}): string {
  const hints = input.editedData && Object.keys(input.editedData).length > 0
    ? `\nUser hints (optional guidance, still trust the document layout first):\n${JSON.stringify(input.editedData, null, 2)}`
    : "";

  return `${ONE_SHOT_VISION_SYSTEM_PROMPT}

Document file name: ${input.fileName}
Preferred style hint: ${input.style || "modern"}${hints}`;
}

async function fetchFileAsInlineData(
  fileUrl: string,
  fileType: string
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download source file (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const headerContentType = response.headers.get("content-type");
  const mimeType = normalizeMimeType(fileType, headerContentType);

  return {
    data: bytes.toString("base64"),
    mimeType,
  };
}

function normalizeMimeType(fileType: string, headerContentType: string | null): string {
  if (fileType === "pdf") return "application/pdf";
  if (fileType === "image/jpg") return "image/jpeg";
  if (fileType.startsWith("image/")) return fileType;

  if (typeof headerContentType === "string" && headerContentType.trim().length > 0) {
    return headerContentType.split(";")[0].trim();
  }

  return "image/png";
}

type VisionBlock = {
  type?: string;
  style?: Record<string, unknown>;
  content?: Record<string, unknown>;
  columns?: string[];
};

type VisionResult = {
  globalStyles?: {
    fontFamily?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  blocks?: VisionBlock[];
};

function buildTemplateFromVisionResult(input: {
  orgId: string;
  fileName: string;
  templateName?: string;
  raw: Record<string, unknown>;
}): TemplateData {
  const vision = normalizeVisionResult(input.raw);
  const blocks = vision.blocks || [];

  const header = findBlock(blocks, "header");
  const table = findBlock(blocks, "line_items_table");
  const totals = findBlock(blocks, "totals_section");
  const footer = findBlock(blocks, "footer");

  const fontFamily = mapFontFamily(vision.globalStyles?.fontFamily);
  const primaryColor = normalizeHexColor(vision.globalStyles?.primaryColor, "#111827");
  const backgroundColor = normalizeHexColor(vision.globalStyles?.backgroundColor, "#ffffff");

  const headerAlignment = mapAlignment(header?.style?.alignment, "left");
  const headerFontSize = mapSizeToPx(header?.style?.fontSize, 34);
  const headerColor = normalizeHexColor(header?.style?.hexColor, primaryColor);
  const headerTitle = asString(header?.content?.title, "INVOICE");
  const headerSubtitle = asString(header?.content?.subtitle, "Invoice #");

  const tableColumns = buildColumns(table?.columns);
  const hasVerticalBorders = asBoolean(table?.style?.hasVerticalBorders, true);
  const hasHorizontalBorders = asBoolean(table?.style?.hasHorizontalBorders, true);
  const resolvedBorderStyle = mapTableBorderStyle(
    asString(table?.style?.borderStyle, ""),
    hasVerticalBorders,
    hasHorizontalBorders
  );
  const headerBackgroundColor = normalizeHexColor(table?.style?.headerBackgroundColor, "#f3f4f6");
  const headerTextColor = normalizeHexColor(table?.style?.headerTextColor, primaryColor);
  const rowStriping = asBoolean(table?.style?.rowStriping, false);

  const totalsAlignment = mapAlignment(totals?.style?.alignment, "right");
  const totalsFontSize = mapSizeToPx(totals?.style?.fontSize, 18);
  const totalsBold = asBoolean(totals?.style?.isBold, true);
  const totalsColor = normalizeHexColor(totals?.style?.hexColor, "#111827");

  const footerAlignment = mapAlignment(footer?.style?.alignment, "left");
  const footerFontSize = mapSizeToPx(footer?.style?.fontSize, 11);
  const footerColor = normalizeHexColor(footer?.style?.hexColor, "#6b7280");
  const footerText = asString(footer?.content?.text, "Thank you for your business.");

  const headerWidth = 300;
  const headerX =
    headerAlignment === "left" ? 40 : headerAlignment === "center" ? 247 : 454;

  const totalsWidth = 300;
  const totalsX =
    totalsAlignment === "left" ? 40 : totalsAlignment === "center" ? 247 : 454;

  const blocksV2: InvoiceBlock[] = [
    {
      id: "header-section",
      type: "container",
      props: {
        x: 40,
        y: 40,
        width: 714,
        height: 140,
        backgroundColor,
        borderWidth: 0,
        opacity: 1,
      },
      children: [
        {
          id: "header-title",
          type: "text",
          props: {
            x: headerX,
            y: 56,
            width: headerWidth,
            height: 46,
            content: headerTitle,
            fontFamily,
            fontSize: headerFontSize,
            fontWeight: "bold",
            color: headerColor,
            align: headerAlignment,
            uppercase: true,
          },
        },
        {
          id: "header-subtitle",
          type: "text",
          props: {
            x: headerX,
            y: 105,
            width: headerWidth,
            height: 22,
            content: headerSubtitle,
            fontFamily,
            fontSize: 12,
            fontWeight: "normal",
            color: "#6b7280",
            align: headerAlignment,
          },
        },
      ],
    },
    {
      id: "line-items",
      type: "lineItems",
      props: {
        x: 40,
        y: 210,
        width: 714,
        height: 430,
        rowHeight: 30,
        headerHeight: 34,
        stripe: rowStriping,
        itemsBinding: "items",
        columns: tableColumns,
        borderStyle: resolvedBorderStyle,
        borderColor: "#d1d5db",
        borderWidth: resolvedBorderStyle === "none" ? 0 : 1,
        headerBackground: headerBackgroundColor,
        headerStyle: {
          fontFamily,
          fontSize: 12,
          fontWeight: "semibold",
          color: headerTextColor,
        },
        rowStyle: {
          fontFamily,
          fontSize: 11,
          fontWeight: "normal",
          color: "#111827",
        },
      },
    },
    {
      id: "totals-section",
      type: "container",
      props: {
        x: totalsX,
        y: 664,
        width: totalsWidth,
        height: 160,
        backgroundColor: "#ffffff",
        borderWidth: 0,
      },
      children: [
        {
          id: "subtotal-label",
          type: "text",
          props: {
            x: totalsX,
            y: 676,
            width: 130,
            height: 24,
            content: "Subtotal",
            fontFamily,
            fontSize: 12,
            fontWeight: "normal",
            color: "#6b7280",
            align: "left",
          },
        },
        {
          id: "subtotal-value",
          type: "text",
          props: {
            x: totalsX + 130,
            y: 676,
            width: 170,
            height: 24,
            content: "Subtotal",
            binding: "subtotal",
            fontFamily,
            fontSize: 12,
            fontWeight: "normal",
            color: "#111827",
            align: "right",
          },
        },
        {
          id: "tax-label",
          type: "text",
          props: {
            x: totalsX,
            y: 706,
            width: 130,
            height: 24,
            content: "Tax",
            fontFamily,
            fontSize: 12,
            fontWeight: "normal",
            color: "#6b7280",
            align: "left",
          },
        },
        {
          id: "tax-value",
          type: "text",
          props: {
            x: totalsX + 130,
            y: 706,
            width: 170,
            height: 24,
            content: "Tax",
            binding: "taxAmount",
            fontFamily,
            fontSize: 12,
            fontWeight: "normal",
            color: "#111827",
            align: "right",
          },
        },
        {
          id: "total-label",
          type: "text",
          props: {
            x: totalsX,
            y: 742,
            width: 130,
            height: 32,
            content: "Total",
            fontFamily,
            fontSize: totalsFontSize,
            fontWeight: totalsBold ? "bold" : "normal",
            color: totalsColor,
            align: "left",
          },
        },
        {
          id: "total-value",
          type: "text",
          props: {
            x: totalsX + 130,
            y: 742,
            width: 170,
            height: 32,
            content: "Total",
            binding: "total",
            fontFamily,
            fontSize: totalsFontSize,
            fontWeight: totalsBold ? "bold" : "normal",
            color: totalsColor,
            align: "right",
          },
        },
      ],
    },
    {
      id: "footer-section",
      type: "text",
      props: {
        x: footerAlignment === "left" ? 40 : footerAlignment === "center" ? 247 : 454,
        y: 1040,
        width: 300,
        height: 24,
        content: footerText,
        fontFamily,
        fontSize: footerFontSize,
        fontWeight: "normal",
        color: footerColor,
        align: footerAlignment,
      },
    },
  ];

  const pageSettings = {
    size: "A4" as const,
    orientation: "portrait" as const,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    backgroundColor,
  };

  const theme = {
    colors: {
      primary: primaryColor,
      secondary: "#6b7280",
      accent: primaryColor,
      text: "#111827",
      muted: "#9ca3af",
      error: "#dc2626",
      success: "#16a34a",
    },
    fonts: {
      primary: fontFamily,
      secondary: fontFamily,
      mono: "ui-monospace",
    },
    radii: { sm: 4, md: 8, lg: 12 },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.08)",
      md: "0 4px 10px rgba(0,0,0,0.14)",
      lg: "0 12px 28px rgba(0,0,0,0.18)",
    },
  };

  const repeating = {
    header: {
      enabled: false,
      height: 80,
      showOnFirstPage: true,
      showOnAllPages: true,
    },
    footer: {
      enabled: false,
      height: 80,
      showOnFirstPage: true,
      showOnAllPages: true,
    },
  };

  const elements = compileInvoiceBlocksToElements({
    blocks: blocksV2,
    template: {
      pageSettings,
      theme,
      repeating,
    },
  });

  const baseName = stripExtension(input.fileName);
  const candidateTemplate = {
    orgId: input.orgId,
    name: input.templateName || `Template from ${baseName}`,
    description: "Generated from invoice file using one-shot Gemini vision.",
    pageSize: "A4",
    brand: {
      fonts: [fontFamily],
      colors: {
        primary: primaryColor,
        secondary: "#6b7280",
        accent: primaryColor,
      },
      margins: {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40,
      },
    },
    layoutModel: "hybrid_v2" as const,
    blocksV2,
    pageSettings,
    theme,
    repeating,
    elements,
    status: "draft" as const,
    schemaVersion: 2,
  };

  const parsed = templateDataSchema.safeParse(candidateTemplate);
  if (!parsed.success) {
    throw new Error(`Generated template failed validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

function normalizeVisionResult(raw: Record<string, unknown>): VisionResult {
  const globalStylesRaw = isRecord(raw.globalStyles) ? raw.globalStyles : {};
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];

  return {
    globalStyles: {
      fontFamily: asString(globalStylesRaw.fontFamily, "sans-serif"),
      primaryColor: asString(globalStylesRaw.primaryColor, "#111827"),
      backgroundColor: asString(globalStylesRaw.backgroundColor, "#ffffff"),
    },
    blocks: blocksRaw
      .filter(isRecord)
      .map((entry) => ({
        type: asString(entry.type, ""),
        style: isRecord(entry.style) ? entry.style : {},
        content: isRecord(entry.content) ? entry.content : {},
        columns: Array.isArray(entry.columns)
          ? entry.columns.filter((value): value is string => typeof value === "string")
          : [],
      })),
  };
}

function findBlock(blocks: VisionBlock[], type: string): VisionBlock | undefined {
  return blocks.find((block) => block.type === type);
}

function buildColumns(columns: string[] | undefined): Array<Record<string, unknown>> {
  const source = Array.isArray(columns) && columns.length > 0
    ? columns
    : ["Item", "Qty", "Price", "Total"];
  const defaultWidth = Math.floor(714 / source.length);

  return source.map((header, index) => {
    const lower = header.toLowerCase();
    const isQty = lower.includes("qty") || lower.includes("quantity");
    const isPrice = lower.includes("price") || lower.includes("rate") || lower.includes("unit");
    const isTotal = lower.includes("total") || lower.includes("amount");

    const binding = isQty
      ? "quantity"
      : isPrice
        ? "unitPrice"
        : isTotal
          ? "total"
          : "description";

    const type = isQty ? "number" : (isPrice || isTotal ? "currency" : "text");
    const align = type === "text" ? "left" : "right";

    return {
      id: `col-${index + 1}`,
      header,
      width: index === source.length - 1 ? defaultWidth + (714 - defaultWidth * source.length) : defaultWidth,
      align,
      type,
      binding,
      format: type === "currency" ? { kind: "currency", currency: "USD" } : { kind: "none" },
      ...(type === "currency" ? { currency: "USD" } : {}),
      showTotal: isTotal,
    };
  });
}

function mapFontFamily(value: string | undefined): string {
  if (typeof value !== "string") return "Inter";
  const normalized = value.toLowerCase();
  return normalized.includes("serif") ? "Georgia" : "Inter";
}

function mapAlignment(value: unknown, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
  if (value === "left" || value === "center" || value === "right") return value;
  return fallback;
}

function mapSizeToPx(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(8, Math.min(72, value));
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "small") return 12;
    if (normalized === "medium") return 16;
    if (normalized === "large") return 24;
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(8, Math.min(72, parsed));
    }
  }
  return fallback;
}

function mapTableBorderStyle(
  explicitBorderStyle: string,
  hasVerticalBorders: boolean,
  hasHorizontalBorders: boolean
): "none" | "rows" | "columns" | "all" | "outer" {
  if (
    explicitBorderStyle === "none" ||
    explicitBorderStyle === "rows" ||
    explicitBorderStyle === "columns" ||
    explicitBorderStyle === "all" ||
    explicitBorderStyle === "outer"
  ) {
    return explicitBorderStyle;
  }

  if (hasVerticalBorders && hasHorizontalBorders) return "all";
  if (hasVerticalBorders) return "columns";
  if (hasHorizontalBorders) return "rows";
  return "none";
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }
  const short = color.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const idx = trimmed.lastIndexOf(".");
  if (idx <= 0) return trimmed || "Invoice";
  return trimmed.slice(0, idx);
}

function estimateQualityFromTemplate(template: TemplateData): TemplateQuality {
  const hasTable = template.elements.some((el) => el.type === "table");
  const hasHeaderText = template.elements.some((el) => el.type === "text" && el.y < 180);
  const hasTotals = template.elements.some(
    (el) =>
      el.type === "text" &&
      ((typeof el.binding === "string" && (el.binding === "total" || el.binding === "subtotal")) ||
        (typeof el.text === "string" && el.text.toLowerCase().includes("total")))
  );

  if (!hasTable || !hasHeaderText) {
    return {
      overall: 0.68,
      layout: hasHeaderText ? 0.72 : 0.55,
      text: 0.72,
      table: hasTable ? 0.72 : 0.45,
      font: 0.7,
    };
  }

  return {
    overall: hasTotals ? 0.86 : 0.8,
    layout: 0.88,
    text: 0.82,
    table: 0.9,
    font: 0.82,
  };
}

function buildReviewReasons(template: TemplateData, raw: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  const hasTable = template.elements.some((el) => el.type === "table");
  const hasHeader = template.elements.some((el) => el.type === "text" && el.y < 180);
  const hasTotals = template.elements.some(
    (el) =>
      el.type === "text" &&
      ((typeof el.binding === "string" && el.binding === "total") ||
        (typeof el.text === "string" && el.text.toLowerCase().includes("total")))
  );

  if (!hasHeader) {
    reasons.push("Header could not be confidently detected from the source file.");
  }
  if (!hasTable) {
    reasons.push("Line items table was not confidently detected.");
  }
  if (!hasTotals) {
    reasons.push("Totals section may need manual alignment or binding adjustments.");
  }
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
    reasons.push("Model output was sparse and used fallback layout defaults.");
  }

  return reasons;
}
