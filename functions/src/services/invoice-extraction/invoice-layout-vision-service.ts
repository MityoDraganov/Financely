import { logger } from "firebase-functions";
import { getAIService, type AIService, type JSONSchema } from "../ai/ai-service";
import type {
  BoundingBox,
  DocumentPage,
  OCRWord,
  VisionLayout,
  VisionLayoutElement,
  VisionLayoutRegion,
  VisionLayoutTable,
  VisionStyleCluster,
} from "./pipeline-types";

const VISION_LAYOUT_SCHEMA: JSONSchema = {
  type: "object",
  properties: {
    regions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          bbox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          confidence: { type: "number" },
        },
      },
    },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          text: { type: "string" },
          bbox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          confidence: { type: "number" },
          styleClusterId: { type: "string" },
          bindingHint: { type: "string" },
          currencyLike: { type: "boolean" },
        },
      },
    },
    tables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          bbox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          columnHeaders: { type: "array", items: { type: "string" } },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                header: { type: "string" },
                type: { type: "string" },
                bbox: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    width: { type: "number" },
                    height: { type: "number" },
                  },
                },
                confidence: { type: "number" },
              },
            },
          },
          headerBBox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          rowCount: { type: "number" },
          confidence: { type: "number" },
        },
      },
    },
    styleClusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          fontFamilyHint: { type: "string" },
          fontWeightHint: { type: "string" },
          fontSizePx: { type: "number" },
          color: { type: "string" },
          sampleTexts: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
      },
    },
  },
};

type VisionLayoutAnalysisInput = {
  pages: DocumentPage[];
  ocrWords?: OCRWord[];
  maxPages?: number;
};

export interface InvoiceLayoutVisionService {
  analyzeDocument(input: VisionLayoutAnalysisInput): Promise<VisionLayout>;
}

class DefaultInvoiceLayoutVisionService implements InvoiceLayoutVisionService {
  constructor(private readonly aiService: AIService = getAIService()) {}

  async analyzeDocument(input: VisionLayoutAnalysisInput): Promise<VisionLayout> {
    const pagesToAnalyze = input.pages
      .slice()
      .sort((a, b) => a.pageIndex - b.pageIndex)
      .slice(0, Math.max(1, Math.min(input.maxPages ?? 5, 5)));
    const wordsByPage = groupWordsByPage(input.ocrWords || []);

    const mergedLayout: VisionLayout = {
      regions: [],
      elements: [],
      tables: [],
      styleClusters: [],
    };

    for (const page of pagesToAnalyze) {
      const pageWords = wordsByPage.get(page.pageIndex) || [];
      const pageLayout = await this.analyzePage(page, pageWords);
      mergedLayout.regions.push(...pageLayout.regions);
      mergedLayout.elements.push(...pageLayout.elements);
      mergedLayout.tables.push(...pageLayout.tables);
      mergedLayout.styleClusters.push(...pageLayout.styleClusters);
    }

    return mergedLayout;
  }

  private async analyzePage(page: DocumentPage, pageWords: OCRWord[]): Promise<VisionLayout> {
    const image = await this.loadPageImage(page);
    const prompt = buildLayoutAnalysisPrompt({
      mode: "full",
      page,
      ocrHints: buildOcrHints(pageWords, 180),
    });

    try {
      const raw = await this.aiService.generateJSONWithImage<Record<string, unknown>>(
        image,
        prompt,
        VISION_LAYOUT_SCHEMA,
        {
          temperature: 0.1,
          maxTokens: 8192,
        }
      );

      return normalizeVisionLayout(raw, page);
    } catch (error) {
      logger.warn("Vision layout primary pass failed for page; retrying with compact prompt", {
        pageIndex: page.pageIndex,
        imageUrl: page.imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });

      try {
        const compactRaw = await this.aiService.generateJSONWithImage<Record<string, unknown>>(
          image,
          buildLayoutAnalysisPrompt({
            mode: "compact",
            page,
            ocrHints: buildOcrHints(pageWords, 100),
          }),
          VISION_LAYOUT_SCHEMA,
          {
            temperature: 0,
            maxTokens: 4096,
          }
        );
        return normalizeVisionLayout(compactRaw, page);
      } catch (retryError) {
        logger.warn("Vision layout fallback pass failed for page", {
          pageIndex: page.pageIndex,
          imageUrl: page.imageUrl,
          error: retryError instanceof Error ? retryError.message : String(retryError),
        });

        return {
          regions: [],
          elements: [],
          tables: [],
          styleClusters: [],
        };
      }
    }
  }

  private async loadPageImage(page: DocumentPage): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(page.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download page image ${page.imageUrl} (${response.status})`);
    }

    const contentType = response.headers.get("content-type") || page.mimeType || "image/png";
    const mimeType = contentType.includes("image/") ? contentType.split(";")[0] : "image/png";
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    return {
      data: imageBuffer.toString("base64"),
      mimeType,
    };
  }
}

function normalizeVisionLayout(raw: Record<string, unknown>, page: DocumentPage): VisionLayout {
  const regionsRaw = Array.isArray(raw.regions) ? raw.regions : [];
  const elementsRaw = Array.isArray(raw.elements) ? raw.elements : [];
  const tablesRaw = Array.isArray(raw.tables) ? raw.tables : [];
  const styleRaw = Array.isArray(raw.styleClusters) ? raw.styleClusters : [];

  const regions: VisionLayoutRegion[] = regionsRaw
    .map((region, index) => normalizeRegion(region, page, index))
    .filter((region): region is VisionLayoutRegion => region !== null);

  const elements: VisionLayoutElement[] = elementsRaw
    .map((element, index) => normalizeElement(element, page, index))
    .filter((element): element is VisionLayoutElement => element !== null);

  const tables: VisionLayoutTable[] = tablesRaw
    .map((table, index) => normalizeTable(table, page, index))
    .filter((table): table is VisionLayoutTable => table !== null);

  const styleClusters: VisionStyleCluster[] = styleRaw
    .map((cluster, index) => normalizeStyleCluster(cluster, page, index))
    .filter((cluster): cluster is VisionStyleCluster => cluster !== null);

  return {
    regions,
    elements,
    tables,
    styleClusters,
  };
}

function normalizeRegion(raw: unknown, page: DocumentPage, index: number): VisionLayoutRegion | null {
  if (!isRecord(raw)) return null;
  const bbox = parseBoundingBox(raw.bbox ?? raw.boundingBox, page.width, page.height);
  if (!bbox) return null;

  const kind = normalizeRegionKind(raw.kind);

  return {
    id: asString(raw.id) || `region-${page.pageIndex}-${index}`,
    pageIndex: page.pageIndex,
    kind,
    boundingBox: bbox,
    confidence: normalizeConfidence(raw.confidence),
  };
}

function normalizeElement(raw: unknown, page: DocumentPage, index: number): VisionLayoutElement | null {
  if (!isRecord(raw)) return null;
  const bbox = parseBoundingBox(raw.bbox ?? raw.boundingBox, page.width, page.height);
  if (!bbox) return null;

  return {
    id: asString(raw.id) || `element-${page.pageIndex}-${index}`,
    pageIndex: page.pageIndex,
    kind: normalizeElementKind(raw.kind),
    text: asString(raw.text),
    boundingBox: bbox,
    confidence: normalizeConfidence(raw.confidence),
    styleClusterId: asString(raw.styleClusterId),
    bindingHint: asString(raw.bindingHint),
    currencyLike: asBoolean(raw.currencyLike),
  };
}

function normalizeTable(raw: unknown, page: DocumentPage, index: number): VisionLayoutTable | null {
  if (!isRecord(raw)) return null;
  const bbox = parseBoundingBox(raw.bbox ?? raw.boundingBox, page.width, page.height);
  if (!bbox) return null;

  const columns = normalizeTableColumns(raw.columns, page);
  const headerBoundingBox = parseBoundingBox(
    raw.headerBBox ?? raw.headerBoundingBox,
    page.width,
    page.height
  );

  return {
    id: asString(raw.id) || `table-${page.pageIndex}-${index}`,
    pageIndex: page.pageIndex,
    boundingBox: bbox,
    columnHeaders: asStringArray(raw.columnHeaders),
    ...(columns.length ? { columns } : {}),
    ...(headerBoundingBox ? { headerBoundingBox } : {}),
    rowCount: normalizeInteger(raw.rowCount, 0),
    confidence: normalizeConfidence(raw.confidence),
  };
}

function normalizeTableColumns(
  raw: unknown,
  page: DocumentPage
): NonNullable<VisionLayoutTable["columns"]> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((column, index) => {
      if (!isRecord(column)) return null;
      const header = asString(column.header);
      const boundingBox = parseBoundingBox(
        column.bbox ?? column.boundingBox,
        page.width,
        page.height
      );
      const type = normalizeTableColumnType(column.type);
      return {
        id: asString(column.id) || `col-${page.pageIndex}-${index}`,
        ...(header ? { header } : {}),
        ...(boundingBox ? { boundingBox } : {}),
        ...(type ? { type } : {}),
        confidence: normalizeConfidence(column.confidence),
      };
    })
    .filter(
      (
        column
      ): column is NonNullable<VisionLayoutTable["columns"]>[number] => column !== null
    );
}

function normalizeTableColumnType(
  value: unknown
): "text" | "number" | "date" | "currency" | "unknown" | undefined {
  const normalized = (asString(value) || "").toLowerCase();
  if (normalized === "text") return "text";
  if (normalized === "number") return "number";
  if (normalized === "date") return "date";
  if (normalized === "currency") return "currency";
  if (normalized === "unknown") return "unknown";
  return undefined;
}

function normalizeStyleCluster(raw: unknown, page: DocumentPage, index: number): VisionStyleCluster | null {
  if (!isRecord(raw)) return null;
  return {
    id: asString(raw.id) || `style-${page.pageIndex}-${index}`,
    fontFamilyHint: asString(raw.fontFamilyHint),
    fontWeightHint: asString(raw.fontWeightHint),
    fontSizePx: normalizeOptionalNumber(raw.fontSizePx),
    color: asString(raw.color),
    sampleTexts: asStringArray(raw.sampleTexts),
    confidence: normalizeConfidence(raw.confidence),
  };
}

function parseBoundingBox(raw: unknown, maxWidth: number, maxHeight: number): BoundingBox | null {
  if (!isRecord(raw)) return null;

  const x = clampNumber(normalizeNumber(raw.x, 0), 0, Math.max(0, maxWidth));
  const y = clampNumber(normalizeNumber(raw.y, 0), 0, Math.max(0, maxHeight));
  const width = clampNumber(normalizeNumber(raw.width, 0), 0, Math.max(0, maxWidth - x));
  const height = clampNumber(normalizeNumber(raw.height, 0), 0, Math.max(0, maxHeight - y));

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function normalizeRegionKind(value: unknown): VisionLayoutRegion["kind"] {
  const normalized = (asString(value) || "misc").toLowerCase();
  if (normalized === "header") return "header";
  if (normalized === "parties") return "parties";
  if (normalized === "meta") return "meta";
  if (normalized === "table") return "table";
  if (normalized === "totals") return "totals";
  if (normalized === "footer") return "footer";
  return "misc";
}

function normalizeElementKind(value: unknown): VisionLayoutElement["kind"] {
  const normalized = (asString(value) || "other").toLowerCase();
  if (normalized === "label") return "label";
  if (normalized === "value") return "value";
  if (normalized === "text") return "text";
  if (normalized === "logo") return "logo";
  if (normalized === "image") return "image";
  if (normalized === "table") return "table";
  if (normalized === "table_header") return "table_header";
  if (normalized === "table_cell") return "table_cell";
  if (normalized === "line") return "line";
  return "other";
}

function normalizeConfidence(value: unknown): number {
  return clampNumber(normalizeNumber(value, 0.5), 0, 1);
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeInteger(value: unknown, fallback: number): number {
  return Math.max(0, Math.round(normalizeNumber(value, fallback)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => !!entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function groupWordsByPage(words: OCRWord[]): Map<number, OCRWord[]> {
  const byPage = new Map<number, OCRWord[]>();
  for (const word of words) {
    if (!byPage.has(word.pageIndex)) {
      byPage.set(word.pageIndex, []);
    }
    byPage.get(word.pageIndex)!.push(word);
  }
  return byPage;
}

function buildOcrHints(words: OCRWord[], maxHints: number): string {
  if (words.length === 0) {
    return "(none)";
  }

  const hints = words
    .slice()
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.boundingBox.y !== b.boundingBox.y) return a.boundingBox.y - b.boundingBox.y;
      return a.boundingBox.x - b.boundingBox.x;
    })
    .slice(0, maxHints)
    .map((word) => {
      const text = sanitizeHintText(word.text);
      const box = word.boundingBox;
      return `"${text}"@(${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}) c=${word.confidence.toFixed(2)}`;
    });

  return hints.join("\n");
}

function sanitizeHintText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .trim()
    .slice(0, 40);
}

function buildLayoutAnalysisPrompt(input: {
  mode: "full" | "compact";
  page: DocumentPage;
  ocrHints: string;
}): string {
  const base = `Analyze this invoice page and return layout semantics as strict JSON.

Page:
- pageIndex=${input.page.pageIndex}
- width=${Math.round(input.page.width)}
- height=${Math.round(input.page.height)}

Rules:
- Coordinates must be absolute pixels for this page.
- Use OCR hints to improve text identity and approximate geometry.
- Prefer concise output and short text values.
- If uncertain, still return best guess with lower confidence.
- Do not include markdown, comments, or explanations.
- Hard caps: regions<=10, elements<=120, tables<=5, styleClusters<=16.
- Trim element text to <=120 characters.
- styleClusters.sampleTexts must contain <=3 short examples.
- For tables, include columns[] with header/type/bbox/confidence when possible.

OCR hints (high-confidence words):
${input.ocrHints}`;

  if (input.mode === "compact") {
    return `${base}

Compact mode:
- Prioritize major structure only (header, parties, meta, table, totals, footer).
- Return fewer elements when in doubt (target <=55).
- Keep JSON minimal while preserving table geometry and column headers.`;
  }

  return `${base}

Extract:
- regions (header, parties, meta, table, totals, footer, misc)
- elements (label, value, text, logo, image, table_header, table_cell, line)
- tables with columnHeaders, columns[], rowCount, confidence
- styleClusters for typography and color hints

Binding hints:
- For invoice identifiers/dates/totals, set element.bindingHint to likely path (invoice_number, date_issued, date_due, subtotal, tax.amount, total, currency) when visible.
- Set currencyLike=true on value elements that look monetary.`;
}

let invoiceLayoutVisionServiceInstance: InvoiceLayoutVisionService | null = null;

export function getInvoiceLayoutVisionService(): InvoiceLayoutVisionService {
  if (!invoiceLayoutVisionServiceInstance) {
    invoiceLayoutVisionServiceInstance = new DefaultInvoiceLayoutVisionService();
  }
  return invoiceLayoutVisionServiceInstance;
}
