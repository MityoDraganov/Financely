import { logger } from "firebase-functions";
import { TemplateData, TemplateElement } from "../../core/entities/template";
import { ExtractionJob } from "../../core/entities/invoice-extraction-job";
import { Organization } from "../../core/entities/organization";
import { invoiceComplianceService } from "../invoice-compliance-service";
import { COMPLIANCE_SCHEMAS } from "../../core/entities/invoice-compliance";
import type {
  BoundingBox,
  FontMatch,
  FusionMapEntry,
  VisionLayout,
  VisionLayoutElement,
} from "./pipeline-types";

const CANVAS_WIDTH = 794;
const CANVAS_HEIGHT = 1123;
type TextTemplateElement = Extract<TemplateElement, { type: "text" }>;
type ImageTemplateElement = Extract<TemplateElement, { type: "image" }>;

type TemplateGenerationOptions = {
  style?: "modern" | "classic" | "minimal" | "professional";
  templateName?: string;
};

/**
 * Compiler-oriented service that converts fused OCR+vision outputs to TemplateData.
 * This intentionally avoids value-to-word heuristic mapping in favor of precomputed fusionMap.
 */
export class OCRToTemplateService {
  convertOCRToTemplate(
    extractionJob: ExtractionJob,
    organization: Organization,
    options?: TemplateGenerationOptions
  ): TemplateData {
    if (!extractionJob.extractedData || Object.keys(extractionJob.extractedData).length === 0) {
      throw new Error("No extracted data available for template generation");
    }

    const rawVisionLayout = extractionJob.visionLayout as unknown;
    const rawFusionMap = extractionJob.fusionMap as unknown;
    const rawFontMatches = extractionJob.fontMatches as unknown;

    const visionLayout = normalizeVisionLayout(rawVisionLayout);
    const fusionMap = normalizeFusionMap(rawFusionMap);
    const fontMatches = normalizeFontMatches(rawFontMatches);

    if (visionLayout.elements.length === 0 && fusionMap.length === 0) {
      throw new Error("No fused layout data available. Run layout_fusion_v2 extraction first.");
    }

    const region = invoiceComplianceService.detectRegion(organization);
    const complianceSchema = COMPLIANCE_SCHEMAS[region];

    const currency =
      organization.settings?.defaultCurrency ||
      ({ US: "USD", EU: "EUR", CA: "CAD", AU: "AUD", UK: "GBP" }[region] ?? "USD");

    const baseFontStack = deriveFontStack(fontMatches);

    const sourcePage = extractionJob.documentPages?.[0];
    const scaleX = sourcePage?.width ? CANVAS_WIDTH / sourcePage.width : 1;
    const scaleY = sourcePage?.height ? CANVAS_HEIGHT / sourcePage.height : 1;

    const elements: TemplateElement[] = [];
    const seenBindings = new Set<string>();

    elements.push(
      ...this.compileStaticTextElements(
        visionLayout.elements,
        visionLayout.styleClusters,
        scaleX,
        scaleY,
        baseFontStack
      )
    );
    elements.push(
      ...this.compileDynamicElements({
        fusionMap,
        visionLayout,
        scaleX,
        scaleY,
        currency,
        seenBindings,
      })
    );
    elements.push(
      ...this.compileTableElements({
        extractedData: extractionJob.extractedData,
        fusionMap,
        visionLayout,
        scaleX,
        scaleY,
        currency,
      })
    );
    elements.push(
      ...this.compileImageElements({
        visionLayout,
        croppedAssets: extractionJob.croppedAssets as Array<{ id: string; imageUrl: string }> | undefined,
        scaleX,
        scaleY,
      })
    );

    if (elements.length === 0) {
      throw new Error("Template compiler produced zero elements from fusion data.");
    }

    const deduped = deduplicateElements(elements);

    logger.info("Compiled template from fused layout", {
      extractionJobId: extractionJob.id,
      elementCount: deduped.length,
      fusionEntryCount: fusionMap.length,
      visionElementCount: visionLayout.elements.length,
    });

    return {
      orgId: organization.id,
      name: options?.templateName || `Template from ${extractionJob.fileName}`,
      description: `Template generated from fused invoice layout: ${extractionJob.fileName}`,
      pageSize: "A4",
      brand: {
        fonts: [baseFontStack],
        colors: {
          primary: organization.settings?.brandColors?.primary || "#111827",
          secondary: organization.settings?.brandColors?.secondary || "#6b7280",
          accent: organization.settings?.brandColors?.accent || "#2563eb",
        },
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
      },
      elements: deduped,
      status: "draft",
      compliance: {
        region,
        requiredFields: complianceSchema.requiredFields.map((field) => field.binding),
        autoFooter: true,
        complianceValidated: false,
      },
    };
  }

  private compileStaticTextElements(
    nodes: VisionLayoutElement[],
    styleClusters: VisionLayout["styleClusters"],
    scaleX: number,
    scaleY: number,
    baseFontStack: string
  ): TemplateElement[] {
    const styleById = new Map(
      styleClusters.map((cluster) => [cluster.id, cluster] as const)
    );
    const textNodes = nodes
      .filter((node) => (node.kind === "label" || node.kind === "text") && !!node.text)
      .slice(0, 80);

    return textNodes
      .map((node, index): TextTemplateElement | null => {
        const box = scaleBoundingBox(node.boundingBox, scaleX, scaleY);
        if (!box) return null;
        const style = node.styleClusterId ? styleById.get(node.styleClusterId) : undefined;

        return {
          id: `static-text-${index + 1}`,
          type: "text" as const,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: 0,
          zIndex: 1,
          visible: true,
          text: truncate(node.text || "", 140),
          typography: {
            fontFamily: style?.fontFamilyHint
              ? `${style.fontFamilyHint}, ${baseFontStack}`
              : baseFontStack,
            fontSize: clamp(
              Math.round((style?.fontSizePx || estimateFontSize(box.height / Math.max(scaleY, 0.01))) * scaleY),
              8,
              32
            ),
            fontWeight: normalizeFontWeightHint(style?.fontWeightHint),
            lineHeight: 1.2,
            letterSpacing: 0,
            color: normalizeColor(style?.color, "#111827"),
            align: "left",
            uppercase: false,
            lowercase: false,
          },
          format: { kind: "none" as const },
          padding: 0,
          opacity: 1,
        };
      })
      .filter((element): element is TextTemplateElement => element !== null);
  }

  private compileDynamicElements(input: {
    fusionMap: FusionMapEntry[];
    visionLayout: VisionLayout;
    scaleX: number;
    scaleY: number;
    currency: string;
    seenBindings: Set<string>;
  }): TemplateElement[] {
    const layoutById = new Map<string, VisionLayoutElement>();
    for (const element of input.visionLayout.elements) {
      layoutById.set(element.id, element);
    }

    const entries = input.fusionMap
      .filter((entry) => entry.fieldType !== "table")
      .sort((a, b) => a.binding.localeCompare(b.binding));

    const output: TemplateElement[] = [];

    for (const entry of entries) {
      if (input.seenBindings.has(entry.binding)) continue;
      const sourceBox = resolveFusionBoundingBox(entry, layoutById);
      const box = scaleBoundingBox(sourceBox, input.scaleX, input.scaleY);
      if (!box) continue;

      input.seenBindings.add(entry.binding);

      if (entry.fieldType === "currency") {
        output.push({
          id: `currency-${safeId(entry.binding)}`,
          type: "currency",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: 0,
          zIndex: 2,
          visible: true,
          binding: entry.binding,
          currency: input.currency,
          currencyLinks: [],
          mode: "independent",
          placeholder: entry.valueText || "",
          align: "right",
        });
        continue;
      }

      const align = entry.fieldType === "number" ? "right" : "left";
      output.push({
        id: `input-${safeId(entry.binding)}`,
        type: "input",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: 0,
        zIndex: 2,
        visible: true,
        binding: entry.binding,
        placeholder: entry.valueText || "",
        variant: entry.fieldType === "date" ? "date" : entry.fieldType === "number" ? "number" : "text",
        align,
      });
    }

    return output;
  }

  private compileTableElements(input: {
    extractedData: Record<string, unknown>;
    fusionMap: FusionMapEntry[];
    visionLayout: VisionLayout;
    scaleX: number;
    scaleY: number;
    currency: string;
  }): TemplateElement[] {
    const tableEntries = input.fusionMap.filter((entry) => entry.fieldType === "table");

    const tables: TemplateElement[] = [];

    for (const entry of tableEntries) {
      const tableData = input.extractedData[entry.binding];
      if (!Array.isArray(tableData) || tableData.length === 0 || typeof tableData[0] !== "object") {
        continue;
      }

      const tableNode = input.visionLayout.tables.find((table) =>
        entry.layoutNodeIds.includes(table.id)
      ) || input.visionLayout.tables[0];

      const sourceBox = entry.boundingBox || tableNode?.boundingBox;
      const box = scaleBoundingBox(sourceBox, input.scaleX, input.scaleY) || {
        x: 40,
        y: 320,
        width: 700,
        height: 300,
      };

      const firstRow = tableData[0] as Record<string, unknown>;
      const keys = Object.keys(firstRow);
      if (keys.length === 0) continue;

      const orderedKeys = orderTableKeys(keys, tableNode?.columns, tableNode?.columnHeaders || []);
      const defaultColumnWidth = Math.max(80, Math.floor(box.width / Math.max(orderedKeys.length, 1)));
      const columnWidthByKey = mapColumnWidthsByHeader(
        orderedKeys,
        tableNode?.columns,
        defaultColumnWidth,
        input.scaleX
      );

      const columns = orderedKeys.map((key) => {
        const sampleValue = firstRow[key];
        const inferredType = inferColumnType(key, sampleValue);
        const currencyLike = inferredType === "currency";
        const numeric = inferredType === "number" || currencyLike;
        const format = currencyLike
          ? { kind: "currency" as const, currency: input.currency }
          : { kind: "none" as const };

        return {
          id: key,
          header: formatColumnHeader(key),
          width: columnWidthByKey.get(key) || defaultColumnWidth,
          align: (numeric ? "right" : "left") as "left" | "center" | "right",
          type: inferredType,
          binding: key,
          format,
          showTotal: currencyLike,
          ...(currencyLike ? { currency: input.currency } : {}),
        };
      });

      const rowCount = Math.max(1, tableData.length);
      const headerHeight = tableNode?.headerBoundingBox
        ? Math.max(18, Math.round(tableNode.headerBoundingBox.height * input.scaleY))
        : Math.max(24, Math.round(box.height * 0.1));
      const rowHeight = Math.max(
        22,
        Math.round((box.height - headerHeight) / Math.max(rowCount, 1))
      );

      tables.push({
        id: `table-${safeId(entry.binding)}`,
        type: "table",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: 0,
        zIndex: 2,
        visible: true,
        itemsBinding: entry.binding,
        columns,
        rowHeight,
        headerHeight,
        stripe: true,
        designRows: [],
        borderStyle: "rows",
        borderColor: "#d1d5db",
        borderWidth: 1,
        cellPadding: { top: 6, right: 10, bottom: 6, left: 10 },
        headerStyle: {
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: "semibold",
          color: "#111827",
        },
        rowStyle: {
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: "normal",
          color: "#374151",
        },
        showFooter: columns.some((column) => column.showTotal),
      });
    }

    return tables;
  }

  private compileImageElements(input: {
    visionLayout: VisionLayout;
    croppedAssets: Array<{ id: string; imageUrl: string }> | undefined;
    scaleX: number;
    scaleY: number;
  }): TemplateElement[] {
    if (!input.croppedAssets || input.croppedAssets.length === 0) {
      return [];
    }

    const assetById = new Map(input.croppedAssets.map((asset) => [asset.id, asset.imageUrl]));

    return input.visionLayout.elements
      .filter((element) => (element.kind === "logo" || element.kind === "image") && assetById.has(element.id))
      .map((element, index): ImageTemplateElement | null => {
        const box = scaleBoundingBox(element.boundingBox, input.scaleX, input.scaleY);
        if (!box) return null;

        return {
          id: `image-${index + 1}`,
          type: "image" as const,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: 0,
          zIndex: 3,
          visible: true,
          src: assetById.get(element.id) || "",
          objectFit: "contain" as const,
          alt: element.kind === "logo" ? "Company logo" : "Decorative asset",
        };
      })
      .filter((element): element is ImageTemplateElement => element !== null && !!element.src);
  }
}

function normalizeVisionLayout(raw: unknown): VisionLayout {
  if (!raw || typeof raw !== "object") {
    return { regions: [], elements: [], tables: [], styleClusters: [] };
  }

  const value = raw as Record<string, unknown>;
  const elements = Array.isArray(value.elements) ? value.elements : [];
  const tables = Array.isArray(value.tables) ? value.tables : [];

  return {
    regions: Array.isArray(value.regions) ? (value.regions as VisionLayout["regions"]) : [],
    elements: elements as VisionLayout["elements"],
    tables: tables as VisionLayout["tables"],
    styleClusters: Array.isArray(value.styleClusters) ? (value.styleClusters as VisionLayout["styleClusters"]) : [],
  };
}

function normalizeFusionMap(raw: unknown): FusionMapEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => entry as FusionMapEntry)
    .filter((entry) => typeof entry.binding === "string");
}

function normalizeFontMatches(raw: unknown): FontMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => entry as FontMatch)
    .filter((entry) => typeof entry.matchedFont === "string" && entry.matchedFont.length > 0);
}

function resolveFusionBoundingBox(
  entry: FusionMapEntry,
  layoutById: Map<string, VisionLayoutElement>
): BoundingBox | null {
  if (entry.boundingBox) {
    return entry.boundingBox;
  }

  for (const nodeId of entry.layoutNodeIds) {
    const node = layoutById.get(nodeId);
    if (node?.boundingBox) {
      return node.boundingBox;
    }
  }

  return null;
}

function scaleBoundingBox(
  boundingBox: BoundingBox | null | undefined,
  scaleX: number,
  scaleY: number
): BoundingBox | null {
  if (!boundingBox) return null;

  const x = clamp(Math.round(boundingBox.x * scaleX), 0, CANVAS_WIDTH - 20);
  const y = clamp(Math.round(boundingBox.y * scaleY), 0, CANVAS_HEIGHT - 20);
  const width = clamp(Math.round(boundingBox.width * scaleX), 20, CANVAS_WIDTH - x);
  const height = clamp(Math.round(boundingBox.height * scaleY), 20, CANVAS_HEIGHT - y);

  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function deriveFontStack(matches: FontMatch[]): string {
  if (matches.length === 0) {
    return "Inter, Arial, sans-serif";
  }

  const sorted = matches.slice().sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];
  return `${primary.matchedFont}, ${primary.fallbackFont}`;
}

function estimateFontSize(height: number): number {
  return Math.max(10, Math.min(22, Math.round(height * 0.65)));
}

function normalizeFontWeightHint(value: string | undefined): "normal" | "medium" | "semibold" | "bold" {
  const hint = (value || "").toLowerCase();
  if (hint.includes("bold")) return "bold";
  if (hint.includes("semi")) return "semibold";
  if (hint.includes("medium")) return "medium";
  return "normal";
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const color = value.trim();
  if (color.length === 0) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgb(a)?\(/i.test(color)) return color;
  return fallback;
}

function formatColumnHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}

function safeId(binding: string): string {
  return binding.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function looksCurrencyKey(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("total") ||
    lower.includes("amount") ||
    lower.includes("price") ||
    lower.includes("tax") ||
    lower.includes("vat")
  );
}

function looksDateValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return (
    /^\d{4}-\d{2}-\d{2}/.test(normalized) ||
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(normalized)
  );
}

function inferColumnType(
  key: string,
  sampleValue: unknown
): "text" | "number" | "date" | "currency" {
  if (looksDateValue(sampleValue) || key.toLowerCase().includes("date")) {
    return "date";
  }

  if (typeof sampleValue === "number") {
    if (looksCurrencyKey(key)) return "currency";
    return "number";
  }

  if (typeof sampleValue === "string") {
    const normalized = sampleValue.replace(/[,\s]/g, "");
    const numeric = Number(normalized.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numeric) && normalized.length > 0 && looksCurrencyKey(key)) {
      return "currency";
    }
  }

  return "text";
}

function orderTableKeys(
  keys: string[],
  columns: VisionLayoutTableColumns | undefined,
  columnHeaders: string[]
): string[] {
  if (!columns || columns.length === 0) {
    if (columnHeaders.length === 0) return keys;
    return orderKeysByHeaders(keys, columnHeaders);
  }

  const used = new Set<string>();
  const ordered: string[] = [];

  for (const column of columns) {
    const header = (column.header || "").toLowerCase().trim();
    if (!header) continue;

    const match = keys.find((key) => !used.has(key) && keyMatchesHeader(key, header));
    if (!match) continue;
    used.add(match);
    ordered.push(match);
  }

  for (const key of keys) {
    if (!used.has(key)) ordered.push(key);
  }

  return ordered;
}

type VisionLayoutTableColumns = VisionLayout["tables"][number]["columns"];

function orderKeysByHeaders(keys: string[], columnHeaders: string[]): string[] {
  const used = new Set<string>();
  const ordered: string[] = [];

  for (const header of columnHeaders) {
    const normalizedHeader = header.toLowerCase().trim();
    const match = keys.find((key) => !used.has(key) && keyMatchesHeader(key, normalizedHeader));
    if (!match) continue;
    used.add(match);
    ordered.push(match);
  }

  for (const key of keys) {
    if (!used.has(key)) ordered.push(key);
  }

  return ordered;
}

function keyMatchesHeader(key: string, normalizedHeader: string): boolean {
  const normalizedKey = key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .toLowerCase();
  return (
    normalizedKey === normalizedHeader ||
    normalizedKey.includes(normalizedHeader) ||
    normalizedHeader.includes(normalizedKey)
  );
}

function mapColumnWidthsByHeader(
  keys: string[],
  columns: VisionLayoutTableColumns | undefined,
  fallbackWidth: number,
  scaleX: number
): Map<string, number> {
  const byKey = new Map<string, number>();
  if (!columns || columns.length === 0) {
    return byKey;
  }

  for (const key of keys) {
    const matchingColumn = columns.find((column) =>
      keyMatchesHeader(key, (column.header || "").toLowerCase().trim())
    );
    if (!matchingColumn?.boundingBox) continue;
    byKey.set(
      key,
      Math.max(60, Math.round(matchingColumn.boundingBox.width * scaleX))
    );
  }

  // Ensure all keys get a width.
  for (const key of keys) {
    if (!byKey.has(key)) {
      byKey.set(key, fallbackWidth);
    }
  }

  return byKey;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function deduplicateElements(elements: TemplateElement[]): TemplateElement[] {
  const unique = new Map<string, TemplateElement>();

  for (const element of elements) {
    const key =
      element.type === "input" || element.type === "currency" || element.type === "text"
        ? `${element.type}:${"binding" in element && element.binding ? element.binding : element.id}`
        : element.id;

    if (!unique.has(key)) {
      unique.set(key, element);
      continue;
    }

    const existing = unique.get(key);
    if (!existing) continue;

    if ((existing.width * existing.height) < (element.width * element.height)) {
      unique.set(key, element);
    }
  }

  return Array.from(unique.values());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

let ocrToTemplateServiceInstance: OCRToTemplateService | null = null;

export function getOCRToTemplateService(): OCRToTemplateService {
  if (!ocrToTemplateServiceInstance) {
    ocrToTemplateServiceInstance = new OCRToTemplateService();
  }
  return ocrToTemplateServiceInstance;
}
