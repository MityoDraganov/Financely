import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { type InvoiceBlock, type TemplateData, type TemplateElement, templateDataSchema } from "../core/entities/template";
import { buildTemplateLlmManifest } from "../core/block-registry";
import { loggerService } from "../services/logger-service";
import { DEFAULT_TEMPLATE_QUALITY, type TemplateQuality, type DocumentPage, type VisionLayoutElement } from "../services/invoice-extraction/pipeline-types";
import { getAIService, type JSONSchema } from "../services/ai/ai-service";
import { getAssetCroppingService } from "../services/invoice-extraction/asset-cropping-service";
import { compileInvoiceBlocksToElements } from "../services/template-compiler/invoice-block-compiler";
import { clampTemplateElementsToPrintableArea } from "../utils/template-printable-bounds";
import { stabilizeTemplateLayout } from "../utils/template-layout-stability";

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
    const boundedCachedTemplate = clampTemplateElementsToPrintableArea(
      stabilizeTemplateLayout(workingJob.generatedTemplate as unknown as TemplateData)
    );
    return {
      template: boundedCachedTemplate,
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

  const template = await buildTemplateFromVisionResult({
    orgId: workingJob.orgId,
    jobId,
    fileName: workingJob.fileName,
    fileUrl: workingJob.fileUrl,
    fileType: workingJob.fileType,
    documentPages: workingJob.documentPages,
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

const CANVAS_WIDTH = 794;
const CANVAS_HEIGHT = 1123;
const STANDARD_PRINT_MARGIN_PX = 96;
const STANDARD_MARGIN_UNIT = "in" as const;
const FALLBACK_IMAGE_PLACEHOLDER_SRC = "";
const VISION_ICON_FALLBACK = "file-text";
const VISION_ICON_CATALOG = (() => {
  const manifest = buildTemplateLlmManifest("invoice_vision_clone");
  const catalog = Array.isArray(manifest.iconCatalog) ? manifest.iconCatalog : [];
  return catalog.length > 0 ? [...catalog] : [VISION_ICON_FALLBACK];
})();
const VISION_ICON_SET = new Set(VISION_ICON_CATALOG);

const ONE_SHOT_VISION_SCHEMA: JSONSchema = {
  type: "object",
  required: ["globalStyles", "blocks", "assets", "elements"],
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
          columns: { type: "array", items: { type: "string" } },
        },
      },
    },
    assets: {
      type: "object",
      properties: {
        icons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              iconName: { type: "string" },
              color: { type: "string" },
              backgroundColor: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              pageIndex: { type: "number" },
              confidence: { type: "number" },
            },
          },
        },
        images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              kind: { type: "string" },
              sourceUrl: { type: "string" },
              alt: { type: "string" },
              objectFit: { type: "string" },
              opacity: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              pageIndex: { type: "number" },
              confidence: { type: "number" },
            },
          },
        },
      },
    },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          text: { type: "string" },
          binding: { type: "string" },
          placeholder: { type: "string" },
          align: { type: "string" },
          fontFamily: { type: "string" },
          typography: { type: "object" },
          iconName: { type: "string" },
          color: { type: "string" },
          backgroundColor: { type: "string" },
          src: { type: "string" },
          objectFit: { type: "string" },
          columns: { type: "array", items: { type: "object" } },
          itemsBinding: { type: "string" },
          borderStyle: { type: "string" },
          borderColor: { type: "string" },
          borderWidth: { type: "number" },
          fill: { type: "string" },
          fillGradient: { type: "object" },
          stroke: { type: "string" },
          strokeWidth: { type: "number" },
          strokeStyle: { type: "string" },
          strokeLinecap: { type: "string" },
          strokeLinejoin: { type: "string" },
          x2: { type: "number" },
          y2: { type: "number" },
          pathData: { type: "string" },
          fillRule: { type: "string" },
          opacity: { type: "number" },
          blendMode: { type: "string" },
        },
      },
    },
    document: {
      type: "object",
      properties: {
        pageWidth: { type: "number" },
        pageHeight: { type: "number" },
      },
    },
  },
};

const ONE_SHOT_VISION_SYSTEM_PROMPT = `
You are an expert Frontend Engineer and UI Designer specialized in cloning invoice layouts.
Your goal is to convert the attached invoice image or PDF into a structured JSON template that matches visual style and structure.

OUTPUT REQUIREMENTS
1. Return STRICT JSON only. No markdown. No explanations.
2. Keep header/table/totals/footer semantics in blocks.
3. Populate elements[] with the FULL visual layout.
- Every visible label/value line should be represented in elements[].
- Include icons in elements[] with type="icon" and a valid iconName.
- Include all visible image/logo regions in elements[] with type="image".
- Include table, totals, footer, and section labels as separate elements.
- For curved/organic shapes, use type="path" with SVG path data (d attribute).
4. Preserve spatial fidelity with x/y/width/height.
- Coordinates may be normalized [0..1] or absolute px, but must be internally consistent.
5. Prefer dynamic field types:
- Use input for editable text/date/number values.
- Use currency for monetary values.
- Use text for static labels.
- Use path for curved decorative elements, waves, organic shapes.
6. Detect ALL visual assets:
- icons: UI glyphs/symbols that should become icon blocks.
- images: logos/photos/seals that should become image blocks.
- paths: curved shapes, waves, organic decorative elements (use SVG path syntax).
7. Use normalized coordinates for all asset bounds (x, y, width, height in [0..1], relative to page).
8. For image assets:
- If direct sourceUrl is known, include it.
- If sourceUrl is not known, still include the image entry (placeholder candidate) with bounds and styles.
- Never drop a detected image region.
9. For curved shapes and decorative elements:
- Detect curves, arcs, and organic shapes that cannot be represented with simple boxes.
- Use type="path" with pathData containing SVG path commands (M, L, C, Q, A, Z).
- Preserve fill colors, gradients, and visual styling.
- Path coordinates should be relative to the element's bounding box (0,0 to width,height).

RULES
- Do not hallucinate table columns.
- If table has no borders, explicitly set both booleans to false.
- For icons, iconName must be selected from the provided icon catalog.
- Text-bearing elements (text/input/currency/table headers/cells) must be sized to fit visible content.
- Do not place text-bearing elements so they overlap each other; keep clear vertical separation.
- Overlap is acceptable only for intentional background layers (e.g., box behind content, decorative paths).
- For complex curved designs: decompose into multiple path elements rather than trying to fit into rectangular boxes.
`;

function buildOneShotVisionPrompt(input: {
  fileName: string;
  style?: "modern" | "classic" | "minimal" | "professional";
  editedData?: Record<string, unknown>;
}): string {
  const llmManifest = buildTemplateLlmManifest("invoice_vision_clone");
  const llmManifestJson = JSON.stringify(llmManifest);
  const iconCatalogText = Array.isArray(llmManifest.iconCatalog)
    ? llmManifest.iconCatalog.join(", ")
    : "file-text";
  const hints = input.editedData && Object.keys(input.editedData).length > 0
    ? `\nUser hints (optional guidance, still trust the document layout first):\n${JSON.stringify(input.editedData, null, 2)}`
    : "";

  return `${ONE_SHOT_VISION_SYSTEM_PROMPT}

Document file name: ${input.fileName}
Preferred style hint: ${input.style || "modern"}

Available icon names (use exactly these values): ${iconCatalogText}

Designer block contract (authoritative JSON for runtime capabilities):
${llmManifestJson}${hints}`;
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

type VisionIconAsset = {
  iconName?: string;
  color?: string;
  backgroundColor?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  pageIndex?: number;
  confidence?: number;
};

type VisionImageAsset = {
  id?: string;
  kind?: string;
  sourceUrl?: string;
  alt?: string;
  objectFit?: string;
  opacity?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  pageIndex?: number;
  confidence?: number;
};

type VisionResult = {
  globalStyles?: {
    fontFamily?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  blocks?: VisionBlock[];
  elements?: Array<Record<string, unknown>>;
  assets?: {
    icons?: VisionIconAsset[];
    images?: VisionImageAsset[];
  };
  document?: {
    pageWidth?: number;
    pageHeight?: number;
  };
};

async function buildTemplateFromVisionResult(input: {
  orgId: string;
  jobId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  documentPages?: DocumentPage[];
  templateName?: string;
  raw: Record<string, unknown>;
}): Promise<TemplateData> {
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

  const baseBlocksV2: InvoiceBlock[] = [
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

  const iconBlocks = buildIconBlocksFromVision(
    vision.assets?.icons || [],
    primaryColor
  );
  const imageBlocks = await buildImageBlocksFromVision({
    orgId: input.orgId,
    jobId: input.jobId,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    documentPages: input.documentPages,
    docWidthHint: safeNumber(vision.document?.pageWidth, 0),
    docHeightHint: safeNumber(vision.document?.pageHeight, 0),
    images: vision.assets?.images || [],
  });
  const scaffoldBlocksV2: InvoiceBlock[] = [...imageBlocks, ...iconBlocks, ...baseBlocksV2];

  const pageSettings = {
    size: "A4" as const,
    orientation: "portrait" as const,
    margins: {
      top: STANDARD_PRINT_MARGIN_PX,
      right: STANDARD_PRINT_MARGIN_PX,
      bottom: STANDARD_PRINT_MARGIN_PX,
      left: STANDARD_PRINT_MARGIN_PX,
    },
    marginUnit: STANDARD_MARGIN_UNIT,
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

  const scaffoldElements = compileInvoiceBlocksToElements({
    blocks: scaffoldBlocksV2,
    template: {
      pageSettings,
      theme,
      repeating,
    },
  });
  const normalizedVisionElements = normalizeVisionElements(
    vision.elements || [],
    {
      primaryColor,
      backgroundColor,
    }
  );
  const assetElements = compileInvoiceBlocksToElements({
    blocks: [...imageBlocks, ...iconBlocks],
    template: {
      pageSettings,
      theme,
      repeating,
    },
  });
  const preferredElements =
    normalizedVisionElements.length >= 8
      ? normalizedVisionElements
      : scaffoldElements;
  const mergedElements = dedupeElements(mergeAssetElements(preferredElements, assetElements));
  const withMandatoryFallbacks = ensureMandatoryStructure(mergedElements, scaffoldElements);
  const withSemanticIcons = enrichSemanticIcons(withMandatoryFallbacks, primaryColor);
  const withoutRedundantBoxes = dropRedundantBackgroundBoxes(withSemanticIcons, backgroundColor);
  const elements = dropUnnecessaryLines(withoutRedundantBoxes);
  const useVisionElements = normalizedVisionElements.length >= 8;

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
        top: STANDARD_PRINT_MARGIN_PX,
        right: STANDARD_PRINT_MARGIN_PX,
        bottom: STANDARD_PRINT_MARGIN_PX,
        left: STANDARD_PRINT_MARGIN_PX,
      },
    },
    ...(useVisionElements ? { layoutModel: "primitive_v1" as const } : { layoutModel: "hybrid_v2" as const }),
    ...(!useVisionElements ? { blocksV2: scaffoldBlocksV2 } : {}),
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
  const stabilized = stabilizeTemplateLayout(parsed.data);
  return clampTemplateElementsToPrintableArea(stabilized);
}

function normalizeVisionResult(raw: Record<string, unknown>): VisionResult {
  const globalStylesRaw = isRecord(raw.globalStyles) ? raw.globalStyles : {};
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];
  const elementsRaw = Array.isArray(raw.elements) ? raw.elements : [];
  const assetsRaw = isRecord(raw.assets) ? raw.assets : {};
  const iconsRaw = Array.isArray(assetsRaw.icons) ? assetsRaw.icons : [];
  const imagesRaw = Array.isArray(assetsRaw.images) ? assetsRaw.images : [];
  const documentRaw = isRecord(raw.document) ? raw.document : {};

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
    elements: elementsRaw.filter(isRecord),
    assets: {
      icons: iconsRaw
        .filter(isRecord)
        .map((icon) => ({
          iconName: asString(icon.iconName, ""),
          color: asString(icon.color, ""),
          backgroundColor: asString(icon.backgroundColor, ""),
          x: safeNumber(icon.x, 0),
          y: safeNumber(icon.y, 0),
          width: safeNumber(icon.width, 0),
          height: safeNumber(icon.height, 0),
          pageIndex: Math.max(0, Math.round(safeNumber(icon.pageIndex, 0))),
          confidence: clamp01(safeNumber(icon.confidence, 0.8)),
        })),
      images: imagesRaw
        .filter(isRecord)
        .map((image) => ({
          id: asString(image.id, ""),
          kind: asString(image.kind, ""),
          sourceUrl: asString(image.sourceUrl, ""),
          alt: asString(image.alt, ""),
          objectFit: asString(image.objectFit, ""),
          opacity: safeNumber(image.opacity, 1),
          x: safeNumber(image.x, 0),
          y: safeNumber(image.y, 0),
          width: safeNumber(image.width, 0),
          height: safeNumber(image.height, 0),
          pageIndex: Math.max(0, Math.round(safeNumber(image.pageIndex, 0))),
          confidence: clamp01(safeNumber(image.confidence, 0.8)),
        })),
    },
    document: {
      pageWidth: safeNumber(documentRaw.pageWidth, 0),
      pageHeight: safeNumber(documentRaw.pageHeight, 0),
    },
  };
}

function findBlock(blocks: VisionBlock[], type: string): VisionBlock | undefined {
  return blocks.find((block) => block.type === type);
}

function buildColumns(columns: string[] | undefined): Array<Record<string, unknown>> {
  const source = Array.isArray(columns) && columns.length > 0
    ? columns
    : ["Item", "Qty", "Price", "Total"];
  const defaultWidthPercent = 100 / source.length;

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
      width: `${Math.round((index === source.length - 1
        ? 100 - defaultWidthPercent * (source.length - 1)
        : defaultWidthPercent) * 100) / 100}%`,
      align,
      type,
      binding,
      format: type === "currency" ? { kind: "currency", currency: "USD" } : { kind: "none" },
      ...(type === "currency" ? { currency: "USD" } : {}),
      showTotal: isTotal,
    };
  });
}

function buildIconBlocksFromVision(icons: VisionIconAsset[], fallbackColor: string): InvoiceBlock[] {
  const out: InvoiceBlock[] = [];
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index];
    const rect = toCanvasRect(icon.x, icon.y, icon.width, icon.height, 16, 16);
    const iconName = normalizeVisionIconName(asString(icon.iconName, VISION_ICON_FALLBACK));

    out.push({
      id: `vision-icon-${index + 1}`,
      type: "icon",
      props: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        iconName,
        color: normalizeHexColor(icon.color, fallbackColor),
        ...(asString(icon.backgroundColor, "") ? { backgroundColor: normalizeHexColor(icon.backgroundColor, "#ffffff") } : {}),
        library: "lucide",
        zIndex: 2,
      },
    });
  }
  return out;
}

async function buildImageBlocksFromVision(input: {
  orgId: string;
  jobId: string;
  fileUrl: string;
  fileType: string;
  documentPages?: DocumentPage[];
  docWidthHint?: number;
  docHeightHint?: number;
  images: VisionImageAsset[];
}): Promise<InvoiceBlock[]> {
  const normalized = input.images.map((image, index) => ({
    id: `${asString(image.id, "vision-image")}-${index + 1}`,
    kind: asString(image.kind, "").toLowerCase() === "logo" ? "logo" as const : "image" as const,
    sourceUrl: asString(image.sourceUrl, ""),
    alt: asString(image.alt, ""),
    objectFit: normalizeImageObjectFit(image.objectFit),
    opacity: clamp01(safeNumber(image.opacity, 1)),
    pageIndex: Math.max(0, Math.round(safeNumber(image.pageIndex, 0))),
    confidence: clamp01(safeNumber(image.confidence, 0.85)),
    rect: toCanvasRect(image.x, image.y, image.width, image.height, 24, 24),
    normalized: toNormalizedRect(image.x, image.y, image.width, image.height),
  }));

  const directSrcById = new Map<string, string>();
  for (const image of normalized) {
    if (isUsableImageSource(image.sourceUrl)) {
      directSrcById.set(image.id, image.sourceUrl);
    }
  }

  const unresolved = normalized.filter((image) => !directSrcById.has(image.id));
  const croppedById = unresolved.length > 0
    ? await cropVisionImages({
      orgId: input.orgId,
      jobId: input.jobId,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      documentPages: input.documentPages,
      docWidthHint: safeNumber(input.docWidthHint, 0),
      docHeightHint: safeNumber(input.docHeightHint, 0),
      candidates: unresolved,
    })
    : new Map<string, string>();

  return normalized.map((image, index) => {
    const src = directSrcById.get(image.id) || croppedById.get(image.id) || FALLBACK_IMAGE_PLACEHOLDER_SRC;
    return {
      id: `vision-image-block-${index + 1}`,
      type: "image",
      props: {
        x: image.rect.x,
        y: image.rect.y,
        width: image.rect.width,
        height: image.rect.height,
        src,
        objectFit: image.objectFit,
        opacity: image.opacity,
        alt: image.alt || (image.kind === "logo" ? "Company logo" : "Invoice image"),
        zIndex: 1,
      },
    } satisfies InvoiceBlock;
  });
}

async function cropVisionImages(input: {
  orgId: string;
  jobId: string;
  fileUrl: string;
  fileType: string;
  documentPages?: DocumentPage[];
  docWidthHint: number;
  docHeightHint: number;
  candidates: Array<{
    id: string;
    kind: "logo" | "image";
    pageIndex: number;
    confidence: number;
    normalized: { x: number; y: number; width: number; height: number };
  }>;
}): Promise<Map<string, string>> {
  const pages = resolveCroppingPages({
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    documentPages: input.documentPages,
    docWidthHint: input.docWidthHint,
    docHeightHint: input.docHeightHint,
  });
  if (pages.length === 0) return new Map<string, string>();

  const pageByIndex = new Map<number, DocumentPage>(pages.map((page) => [page.pageIndex, page]));
  const elements: VisionLayoutElement[] = [];
  for (const candidate of input.candidates) {
    const page = pageByIndex.get(candidate.pageIndex);
    if (!page) continue;

    const box = normalizedToAbsoluteBox(candidate.normalized, page.width, page.height);
    if (box.width < 24 || box.height < 24) continue;

    elements.push({
      id: candidate.id,
      pageIndex: candidate.pageIndex,
      kind: candidate.kind,
      boundingBox: box,
      confidence: candidate.confidence,
    });
  }

  if (elements.length === 0) return new Map<string, string>();

  try {
    const cropped = await getAssetCroppingService().cropAssets({
      orgId: input.orgId,
      jobId: input.jobId,
      pages,
      visionLayout: {
        regions: [],
        elements,
        tables: [],
        styleClusters: [],
      },
      maxAssets: elements.length,
    });
    return new Map(cropped.map((asset) => [asset.id, asset.imageUrl]));
  } catch (error) {
    loggerService.warn("Vision image cropping failed, placeholders will be used", {
      jobId: input.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map<string, string>();
  }
}

function resolveCroppingPages(input: {
  fileUrl: string;
  fileType: string;
  documentPages?: DocumentPage[];
  docWidthHint: number;
  docHeightHint: number;
}): DocumentPage[] {
  if (Array.isArray(input.documentPages) && input.documentPages.length > 0) {
    return input.documentPages;
  }

  const mimeType = normalizeMimeType(input.fileType, null);
  if (!mimeType.startsWith("image/")) {
    return [];
  }

  const width = safeNumber(input.docWidthHint, 0) > 0 ? safeNumber(input.docWidthHint, CANVAS_WIDTH) : CANVAS_WIDTH;
  const height = safeNumber(input.docHeightHint, 0) > 0 ? safeNumber(input.docHeightHint, CANVAS_HEIGHT) : CANVAS_HEIGHT;

  return [{
    pageIndex: 0,
    width: Math.max(200, Math.round(width)),
    height: Math.max(200, Math.round(height)),
    imageUrl: input.fileUrl,
    mimeType,
    source: "original",
  }];
}

function normalizedToAbsoluteBox(
  box: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, Math.floor(box.x * pageWidth));
  const y = Math.max(0, Math.floor(box.y * pageHeight));
  const width = Math.max(1, Math.floor(box.width * pageWidth));
  const height = Math.max(1, Math.floor(box.height * pageHeight));
  return {
    x,
    y,
    width: Math.min(width, Math.max(1, Math.floor(pageWidth) - x)),
    height: Math.min(height, Math.max(1, Math.floor(pageHeight) - y)),
  };
}

function toNormalizedRect(
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown
): { x: number; y: number; width: number; height: number } {
  const nx = normalizeToUnit(safeNumber(x, 0), CANVAS_WIDTH);
  const ny = normalizeToUnit(safeNumber(y, 0), CANVAS_HEIGHT);
  const nw = clampRange(normalizeToUnit(safeNumber(width, 0), CANVAS_WIDTH), 0.01, 1);
  const nh = clampRange(normalizeToUnit(safeNumber(height, 0), CANVAS_HEIGHT), 0.01, 1);
  return {
    x: clampRange(nx, 0, 1 - nw),
    y: clampRange(ny, 0, 1 - nh),
    width: nw,
    height: nh,
  };
}

function toCanvasRect(
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown,
  minWidth: number,
  minHeight: number
): { x: number; y: number; width: number; height: number } {
  const normalized = toNormalizedRect(x, y, width, height);
  const w = Math.max(minWidth, Math.round(normalized.width * CANVAS_WIDTH));
  const h = Math.max(minHeight, Math.round(normalized.height * CANVAS_HEIGHT));
  const maxX = Math.max(0, CANVAS_WIDTH - w);
  const maxY = Math.max(0, CANVAS_HEIGHT - h);
  return {
    x: Math.round(clampRange(normalized.x * CANVAS_WIDTH, 0, maxX)),
    y: Math.round(clampRange(normalized.y * CANVAS_HEIGHT, 0, maxY)),
    width: w,
    height: h,
  };
}

function normalizeToUnit(value: number, axisMax: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1 && value >= 0) return value;
  if (axisMax <= 0) return 0;
  return clamp01(value / axisMax);
}

function normalizeVisionIconName(iconName: string): string {
  const normalized = iconName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
  if (VISION_ICON_SET.has(normalized)) return normalized;
  return VISION_ICON_FALLBACK;
}

function normalizeImageObjectFit(value: unknown): "contain" | "cover" | "fill" | "none" | "scale-down" {
  if (
    value === "contain" ||
    value === "cover" ||
    value === "fill" ||
    value === "none" ||
    value === "scale-down"
  ) {
    return value;
  }
  return "contain";
}

function isUsableImageSource(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

function normalizeVisionElements(
  rawElements: Array<Record<string, unknown>>,
  style: { primaryColor: string; backgroundColor: string }
): TemplateElement[] {
  const out: TemplateElement[] = [];

  for (let index = 0; index < rawElements.length; index += 1) {
    const entry = rawElements[index];
    const type = asString(entry.type, "").toLowerCase();
    if (!type) continue;

    const rect = toCanvasRect(entry.x, entry.y, entry.width, entry.height, 12, 12);
    const base = {
      id: asString(entry.id, `${type}-${index + 1}`),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rotation: 0,
      zIndex: Math.max(0, Math.round(safeNumber(entry.zIndex, 1))),
      visible: true,
    };

    if (type === "text" || type === "label") {
      out.push({
        ...base,
        type: "text",
        text: asString(entry.text, asString(entry.content, "")),
        ...(asString(entry.binding, "") ? { binding: asString(entry.binding, "") } : {}),
        typography: normalizeVisionTypography(
          isRecord(entry.typography) ? entry.typography : {},
          style.primaryColor
        ),
        format: { kind: "none" },
        opacity: clamp01(safeNumber(entry.opacity, 1)),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "input") {
      out.push({
        ...base,
        type: "input",
        placeholder: asString(entry.placeholder, asString(entry.text, "")),
        ...(asString(entry.binding, "") ? { binding: asString(entry.binding, "") } : {}),
        variant: normalizeInputVariant(asString(entry.variant, "")),
        align: normalizeAlign(asString(entry.align, "")),
        ...(asString(entry.fontFamily, "") ? { fontFamily: asString(entry.fontFamily, "") } : {}),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "currency") {
      out.push({
        ...base,
        type: "currency",
        placeholder: asString(entry.placeholder, asString(entry.text, "")),
        ...(asString(entry.binding, "") ? { binding: asString(entry.binding, "") } : {}),
        currency: normalizeCurrencyCode(asString(entry.currency, "USD")),
        currencyLinks: [],
        mode: "independent",
        align: normalizeAlign(asString(entry.align, "")),
        ...(asString(entry.fontFamily, "") ? { fontFamily: asString(entry.fontFamily, "") } : {}),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "icon") {
      out.push({
        ...base,
        type: "icon",
        iconName: normalizeVisionIconName(asString(entry.iconName, VISION_ICON_FALLBACK)),
        color: normalizeHexColor(entry.color, style.primaryColor),
        ...(asString(entry.backgroundColor, "") ? { backgroundColor: normalizeHexColor(entry.backgroundColor, style.backgroundColor) } : {}),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "image" || type === "logo") {
      out.push({
        ...base,
        type: "image",
        src: asString(entry.src, FALLBACK_IMAGE_PLACEHOLDER_SRC),
        objectFit: normalizeImageObjectFit(entry.objectFit),
        ...(asString(entry.binding, "") ? { binding: asString(entry.binding, "") } : {}),
        ...(asString(entry.alt, "") ? { alt: asString(entry.alt, "") } : {}),
        opacity: clamp01(safeNumber(entry.opacity, 1)),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "table" || type === "line_items_table") {
      const columns = normalizeVisionTableColumns(entry.columns);
      out.push({
        ...base,
        type: "table",
        rowHeight: Math.max(18, Math.round(safeNumber(entry.rowHeight, 28))),
        headerHeight: Math.max(0, Math.round(safeNumber(entry.headerHeight, 30))),
        stripe: asBoolean(entry.stripe, false),
        columns,
        itemsBinding: asString(entry.itemsBinding, "items"),
        designRows: [],
        ...(normalizeTableBorderStyle(entry.borderStyle) ? { borderStyle: normalizeTableBorderStyle(entry.borderStyle)! } : {}),
        ...(asString(entry.borderColor, "") ? { borderColor: normalizeHexColor(entry.borderColor, "#d1d5db") } : {}),
        ...(typeof entry.borderWidth === "number" ? { borderWidth: Math.max(0, safeNumber(entry.borderWidth, 1)) } : {}),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "line") {
      out.push({
        ...base,
        type: "line",
        x2: safeNumber(entry.x2, rect.x + rect.width),
        y2: safeNumber(entry.y2, rect.y),
        stroke: normalizeHexColor(entry.stroke, "#d1d5db"),
        strokeWidth: Math.max(0.5, safeNumber(entry.strokeWidth, 1)),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "box" || type === "shape" || type === "container") {
      out.push({
        ...base,
        type: "box",
        fill: normalizeHexColor(entry.fill ?? entry.backgroundColor, style.backgroundColor),
        stroke: normalizeHexColor(entry.stroke, "#d1d5db"),
        strokeWidth: Math.max(0, safeNumber(entry.strokeWidth, 0)),
        radius: Math.max(0, safeNumber(entry.radius, 0)),
        opacity: clamp01(safeNumber(entry.opacity, 1)),
      } satisfies TemplateElement);
      continue;
    }

    if (type === "path") {
      const pathData = asString(entry.pathData, "M 0,0 L 100,0 L 50,100 Z");
      const fillGradient = isRecord(entry.fillGradient)
        ? {
            type: (entry.fillGradient.type === "linear" || entry.fillGradient.type === "radial"
              ? entry.fillGradient.type
              : "linear") as "linear" | "radial",
            colors: Array.isArray(entry.fillGradient.colors)
              ? entry.fillGradient.colors.filter((c): c is string => typeof c === "string").slice(0, 4)
              : ["#3b82f6", "#8b5cf6"],
            angle: safeNumber(entry.fillGradient.angle, 90),
          }
        : undefined;

      out.push({
        ...base,
        type: "path",
        pathData,
        fill: normalizeHexColor(entry.fill, style.primaryColor),
        ...(fillGradient ? { fillGradient } : {}),
        ...(asString(entry.stroke, "") ? { stroke: normalizeHexColor(entry.stroke, "#000000") } : {}),
        strokeWidth: Math.max(0, safeNumber(entry.strokeWidth, 0)),
        ...(asString(entry.strokeStyle, "") ? { strokeStyle: entry.strokeStyle as "solid" | "dashed" | "dotted" } : {}),
        ...(asString(entry.strokeLinecap, "") ? { strokeLinecap: entry.strokeLinecap as "butt" | "round" | "square" } : {}),
        ...(asString(entry.strokeLinejoin, "") ? { strokeLinejoin: entry.strokeLinejoin as "miter" | "round" | "bevel" } : {}),
        fillRule: (entry.fillRule === "evenodd" ? "evenodd" : "nonzero") as "nonzero" | "evenodd",
        opacity: clamp01(safeNumber(entry.opacity, 1)),
        scaleStroke: asBoolean(entry.scaleStroke, false),
        ...(asString(entry.blendMode, "") ? { blendMode: entry.blendMode as any } : {}),
      } satisfies TemplateElement);
      continue;
    }
  }

  return out;
}

function normalizeVisionTypography(
  typography: Record<string, unknown>,
  fallbackColor: string
): Extract<TemplateElement, { type: "text" }>["typography"] {
  const fontWeightRaw = asString(typography.fontWeight, "normal");
  const fontWeight =
    fontWeightRaw === "normal" ||
    fontWeightRaw === "medium" ||
    fontWeightRaw === "semibold" ||
    fontWeightRaw === "bold"
      ? fontWeightRaw
      : "normal";

  const alignRaw = asString(typography.align, "left");
  const align =
    alignRaw === "left" || alignRaw === "center" || alignRaw === "right" || alignRaw === "justify"
      ? alignRaw
      : "left";

  return {
    fontFamily: asString(typography.fontFamily, "Inter"),
    fontSize: Math.max(8, Math.min(72, safeNumber(typography.fontSize, 12))),
    fontWeight,
    fontStyle: asString(typography.fontStyle, "normal") === "italic" ? "italic" : "normal",
    lineHeight: Math.max(0.8, Math.min(2.4, safeNumber(typography.lineHeight, 1.2))),
    letterSpacing: safeNumber(typography.letterSpacing, 0),
    color: normalizeHexColor(typography.color, fallbackColor),
    align,
    uppercase: asBoolean(typography.uppercase, false),
    lowercase: asBoolean(typography.lowercase, false),
  };
}

function normalizeVisionTableColumns(
  rawColumns: unknown
): Extract<TemplateElement, { type: "table" }>["columns"] {
  if (!Array.isArray(rawColumns)) {
    return buildColumns(undefined) as Extract<TemplateElement, { type: "table" }>["columns"];
  }

  const cols = rawColumns
    .filter(isRecord)
    .map((column, index) => {
      const header = asString(column.header, asString(column.label, asString(column.name, `Column ${index + 1}`)));
      const typeRaw = asString(column.type, "text").toLowerCase();
      const type = typeRaw === "number" || typeRaw === "date" || typeRaw === "currency" ? typeRaw : "text";
      const align = normalizeAlign(asString(column.align, type === "text" ? "left" : "right"));
      const binding = asString(column.binding, deriveBindingFromHeader(header));
      const width = normalizeColumnWidth(column.width, rawColumns.length);

      return {
        id: asString(column.id, `col-${index + 1}`),
        header,
        width,
        align,
        type,
        binding,
        format: type === "currency" ? { kind: "currency" as const, currency: "USD" } : { kind: "none" as const },
        ...(type === "currency" ? { currency: "USD" } : {}),
        showTotal: asBoolean(column.showTotal, header.toLowerCase().includes("total")),
      };
    });

  return cols.length > 0
    ? cols as Extract<TemplateElement, { type: "table" }>["columns"]
    : buildColumns(undefined) as Extract<TemplateElement, { type: "table" }>["columns"];
}

function deriveBindingFromHeader(header: string): string {
  const lower = header.toLowerCase();
  if (lower.includes("qty") || lower.includes("quantity")) return "quantity";
  if (lower.includes("price") || lower.includes("rate") || lower.includes("unit")) return "unitPrice";
  if (lower.includes("amount") || lower.includes("total")) return "total";
  return "description";
}

function normalizeAlign(value: string): "left" | "center" | "right" {
  if (value === "center" || value === "right") return value;
  return "left";
}

function normalizeInputVariant(value: string): "text" | "number" | "date" {
  if (value === "number" || value === "date") return value;
  return "text";
}

function normalizeCurrencyCode(value: string): string {
  const upper = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return "USD";
}

function normalizeTableBorderStyle(value: unknown): "none" | "rows" | "columns" | "all" | "outer" | undefined {
  return value === "none" || value === "rows" || value === "columns" || value === "all" || value === "outer"
    ? value
    : undefined;
}

function normalizeColumnWidth(value: unknown, columnCount: number): string {
	const trackRegex = /^([0-9]*\.?[0-9]+)\s*(%|fr)$/i;
	if (typeof value === "string") {
		const trimmed = value.trim().toLowerCase();
		const match = trackRegex.exec(trimmed);
		if (match) {
			const parsed = Number(match[1]);
			if (Number.isFinite(parsed) && parsed > 0) {
				return `${Math.round(parsed * 100) / 100}${match[2]}`;
			}
		}
		const numeric = Number(trimmed);
		if (Number.isFinite(numeric) && numeric > 0) {
			return `${Math.round(numeric * 100) / 100}fr`;
		}
	}
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return `${Math.round(value * 100) / 100}fr`;
	}
	const fallbackPercent = 100 / Math.max(1, columnCount);
	return `${Math.round(fallbackPercent * 100) / 100}%`;
}

function mergeAssetElements(
  preferred: TemplateElement[],
  assetElements: TemplateElement[]
): TemplateElement[] {
  const out = [...preferred];
  const preferredIcons = out.filter((element) => element.type === "icon");
  const preferredImages = out.filter((element) => element.type === "image");
  const assetIcons = assetElements.filter((element) => element.type === "icon");
  const assetImages = assetElements.filter((element) => element.type === "image");

  if (preferredIcons.length < assetIcons.length) {
    out.push(...assetIcons);
  }
  if (preferredImages.length < assetImages.length) {
    out.push(...assetImages);
  }
  return out;
}

function dedupeElements(elements: TemplateElement[]): TemplateElement[] {
  const seen = new Set<string>();
  const out: TemplateElement[] = [];
  for (const element of elements) {
    const key = [
      element.type,
      Math.round(element.x),
      Math.round(element.y),
      Math.round(element.width),
      Math.round(element.height),
      element.type === "text" ? (element.text || "") : "",
      element.type === "icon" ? (element.iconName || "") : "",
      element.type === "image" ? (element.src || "") : "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(element);
  }
  return out;
}

function ensureMandatoryStructure(
  elements: TemplateElement[],
  scaffoldElements: TemplateElement[]
): TemplateElement[] {
  const out = [...elements];
  const hasTable = out.some((element) => element.type === "table");
  if (!hasTable) {
    const table = scaffoldElements.find((element) => element.type === "table");
    if (table) out.push(table);
  }

  const hasTopHeader = out.some((element) => element.type === "text" && element.y < 180);
  if (!hasTopHeader) {
    const headerTexts = scaffoldElements.filter((element) => element.type === "text" && element.y < 180);
    out.push(...headerTexts.slice(0, 2));
  }

  return out;
}

function enrichSemanticIcons(
  elements: TemplateElement[],
  primaryColor: string
): TemplateElement[] {
  const out = [...elements];
  const iconCount = out.filter((element) => element.type === "icon").length;
  if (iconCount >= 2) return out;

  const textElements = out.filter((element): element is Extract<TemplateElement, { type: "text" }> => element.type === "text");

  const addIconNearText = (iconName: string, text: Extract<TemplateElement, { type: "text" }>) => {
    const y = Math.round(text.y + Math.max(0, (text.height - 16) / 2));
    const x = Math.max(8, Math.round(text.x - 24));
    const hasNearbyIcon = out.some((element) => {
      if (element.type !== "icon") return false;
      return Math.abs(element.y - y) <= 18 && Math.abs((element.x + element.width) - text.x) <= 28;
    });
    if (hasNearbyIcon) return;
    out.push({
      id: `semantic-icon-${iconName}-${out.length + 1}`,
      type: "icon",
      x,
      y,
      width: 16,
      height: 16,
      rotation: 0,
      zIndex: text.zIndex,
      visible: true,
      iconName,
      color: primaryColor,
    });
  };

  for (const text of textElements) {
    const raw = (text.text || "").trim();
    if (!raw) continue;
    if (/\S+@\S+\.\S+/.test(raw)) {
      addIconNearText("mail", text);
      continue;
    }
    if (/(\+?\d[\d\s().-]{6,}\d)/.test(raw)) {
      addIconNearText("phone", text);
      continue;
    }
    if (/\b(road|rd|street|st|suite|ave|avenue|blvd|boulevard|lane|ln|drive|dr)\b/i.test(raw) || /\d{2,}\s+\w+/.test(raw)) {
      addIconNearText("map-pin", text);
    }
  }

  return dedupeElements(out);
}

function dropRedundantBackgroundBoxes(
  elements: TemplateElement[],
  backgroundColor: string
): TemplateElement[] {
  return elements.filter((element) => {
    if (element.type !== "box") return true;
    const fill = normalizeHexColor(element.fill, "");
    const bg = normalizeHexColor(backgroundColor, "");
    const hasVisibleStroke = element.strokeWidth > 0 && !colorsEquivalent(element.stroke, bg);
    if (colorsEquivalent(fill, bg) && !hasVisibleStroke) {
      return false;
    }
    return true;
  });
}

function dropUnnecessaryLines(elements: TemplateElement[]): TemplateElement[] {
  const nonLines = elements.filter((element) => element.type !== "line");
  const lines = elements.filter(
    (element): element is Extract<TemplateElement, { type: "line" }> => element.type === "line"
  );
  if (lines.length === 0) return elements;

  const tableBoxes = elements
    .filter((element): element is Extract<TemplateElement, { type: "table" }> => element.type === "table")
    .map((table) => ({
      left: table.x,
      top: table.y,
      right: table.x + table.width,
      bottom: table.y + table.height,
    }));

  const keptLines: Array<{
    line: Extract<TemplateElement, { type: "line" }>;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    isHorizontal: boolean;
    isVertical: boolean;
    length: number;
  }> = [];

  const sortedLines = [...lines].sort((a, b) => {
    const aLength = Math.hypot((a.x2 ?? a.x + a.width) - a.x, (a.y2 ?? a.y + a.height) - a.y);
    const bLength = Math.hypot((b.x2 ?? b.x + b.width) - b.x, (b.y2 ?? b.y + b.height) - b.y);
    return bLength - aLength;
  });

  const snapTolerance = 2;
  const endpointTolerance = 4;
  const minUsefulLength = 28;

  for (const line of sortedLines) {
    const x1 = line.x;
    const y1 = line.y;
    const x2 = line.x2 ?? line.x + line.width;
    const y2 = line.y2 ?? line.y + line.height;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const isHorizontal = dy <= snapTolerance;
    const isVertical = dx <= snapTolerance;
    const length = Math.hypot(dx, dy);

    // Most accidental artifacts are tiny lines.
    if (length < minUsefulLength) continue;

    // If the line is fully inside a detected table, the table block already renders structure.
    const insideTable = tableBoxes.some((table) =>
      minX >= table.left + 2 &&
      maxX <= table.right - 2 &&
      minY >= table.top + 2 &&
      maxY <= table.bottom - 2
    );
    if (insideTable) continue;

    const duplicate = keptLines.some((kept) => {
      if (isHorizontal && kept.isHorizontal) {
        return (
          Math.abs(y1 - kept.y1) <= snapTolerance &&
          Math.abs(minX - kept.minX) <= endpointTolerance &&
          Math.abs(maxX - kept.maxX) <= endpointTolerance
        );
      }
      if (isVertical && kept.isVertical) {
        return (
          Math.abs(x1 - kept.x1) <= snapTolerance &&
          Math.abs(minY - kept.minY) <= endpointTolerance &&
          Math.abs(maxY - kept.maxY) <= endpointTolerance
        );
      }
      return (
        Math.abs(x1 - kept.x1) <= endpointTolerance &&
        Math.abs(y1 - kept.y1) <= endpointTolerance &&
        Math.abs(x2 - kept.x2) <= endpointTolerance &&
        Math.abs(y2 - kept.y2) <= endpointTolerance
      );
    });
    if (duplicate) continue;

    keptLines.push({
      line,
      x1,
      y1,
      x2,
      y2,
      minX,
      maxX,
      minY,
      maxY,
      isHorizontal,
      isVertical,
      length,
    });
  }

  // Keep original ordering for stable rendering/z-index expectations.
  const keptLineIds = new Set(keptLines.map((entry) => entry.line.id));
  const filteredLines = lines.filter((line) => keptLineIds.has(line.id));

  return [...nonLines, ...filteredLines];
}

function colorsEquivalent(a: unknown, b: unknown): boolean {
  const ca = normalizeHexColor(a, "");
  const cb = normalizeHexColor(b, "");
  return ca.length > 0 && cb.length > 0 && ca === cb;
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

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clampRange(value, 0, 1);
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
  const unresolvedImageCount = template.elements.reduce((count, element) => {
    if (element.type !== "image") return count;
    return element.src ? count : count + 1;
  }, 0);

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
  if (unresolvedImageCount > 0) {
    reasons.push(
      `${unresolvedImageCount} image placeholder block(s) were created without source URLs and may need manual assignment.`
    );
  }

  return reasons;
}
