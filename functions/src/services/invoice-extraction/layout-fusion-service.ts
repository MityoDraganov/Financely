import type {
  BoundingBox,
  FontMatch,
  FusionMapEntry,
  OCRWord,
  TemplateQuality,
  VisionLayout,
} from "./pipeline-types";

export type LayoutFusionInput = {
  extractedData: Record<string, unknown>;
  ocrWords: OCRWord[];
  visionLayout: VisionLayout;
  fontMatches: FontMatch[];
};

export type LayoutFusionResult = {
  fusionMap: FusionMapEntry[];
  quality: TemplateQuality;
  needsReview: boolean;
  reviewReasons: string[];
};

export interface LayoutFusionService {
  fuse(input: LayoutFusionInput): LayoutFusionResult;
}

class DefaultLayoutFusionService implements LayoutFusionService {
  fuse(input: LayoutFusionInput): LayoutFusionResult {
    const primitiveFields = flattenPrimitiveFields(input.extractedData);
    const fusionMap: FusionMapEntry[] = [];

    for (const field of primitiveFields) {
      const valueText = stringifyValue(field.value);
      const ocrMatches = findMatchingWords(input.ocrWords, valueText);
      const ocrWordIds = ocrMatches.map((word) => word.id);
      const bbox = combineBoundingBoxes(ocrMatches.map((word) => word.boundingBox));
      const layoutNodeIds = findIntersectingLayoutNodes(input.visionLayout.elements, bbox, valueText);

      const confidence = calculateEntryConfidence(ocrMatches, layoutNodeIds.length > 0);
      const entry: FusionMapEntry = {
        binding: field.path,
        valueText,
        ocrWordIds,
        layoutNodeIds,
        confidence,
        fieldType: detectFieldType(field.path, field.value),
      };

      if (bbox) {
        entry.boundingBox = bbox;
      }

      fusionMap.push(entry);
    }

    for (const [key, value] of Object.entries(input.extractedData)) {
      if (!Array.isArray(value)) continue;
      if (value.length === 0 || typeof value[0] !== "object" || value[0] === null) continue;

      fusionMap.push(inferTableFusionEntry({
        binding: key,
        rows: value as Array<Record<string, unknown>>,
        ocrWords: input.ocrWords,
        visionLayout: input.visionLayout,
      }));
    }

    const quality = calculateQuality(input, fusionMap);
    const { needsReview, reviewReasons } = determineReview(quality, fusionMap);

    return {
      fusionMap,
      quality,
      needsReview,
      reviewReasons,
    };
  }
}

function flattenPrimitiveFields(
  data: Record<string, unknown>,
  prefix = ""
): Array<{ path: string; value: unknown }> {
  const fields: Array<{ path: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      continue;
    }

    if (typeof value === "object") {
      fields.push(...flattenPrimitiveFields(value as Record<string, unknown>, path));
      continue;
    }

    fields.push({ path, value });
  }

  return fields;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function findMatchingWords(words: OCRWord[], valueText: string): OCRWord[] {
  const normalizedValue = valueText.toLowerCase().trim();
  if (!normalizedValue) return [];

  const directMatches = words.filter((word) => word.text.toLowerCase().trim() === normalizedValue);
  if (directMatches.length > 0) return directMatches;

  const tokenized = normalizedValue
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokenized.length > 1) {
    const tokenSet = new Set(tokenized);
    const tokenMatches = words.filter((word) => tokenSet.has(word.text.toLowerCase().trim()));
    if (tokenMatches.length > 0) {
      return tokenMatches;
    }
  }

  const partialMatches = words.filter((word) => {
    const normalizedWord = word.text.toLowerCase().trim();
    return normalizedWord.includes(normalizedValue) || normalizedValue.includes(normalizedWord);
  });

  if (partialMatches.length > 0) return partialMatches;

  const numericCandidate = normalizedValue.replace(/[^0-9.-]/g, "");
  if (numericCandidate.length > 0) {
    return words.filter((word) => {
      const normalizedWord = word.text.replace(/[^0-9.-]/g, "");
      return normalizedWord === numericCandidate || normalizedWord.includes(numericCandidate);
    });
  }

  return [];
}

function combineBoundingBoxes(boxes: BoundingBox[]): BoundingBox | null {
  if (boxes.length === 0) return null;

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function findIntersectingLayoutNodes(
  nodes: VisionLayout["elements"],
  bbox: BoundingBox | null,
  valueText: string
): string[] {
  if (!bbox) return [];

  const normalizedValue = valueText.toLowerCase().trim();

  return nodes
    .filter((node) => {
      const overlap = intersectionOverUnion(node.boundingBox, bbox);
      if (overlap >= 0.15) return true;
      if (normalizedValue.length === 0) return false;
      const nodeText = (node.text || "").toLowerCase();
      return nodeText.includes(normalizedValue) || normalizedValue.includes(nodeText);
    })
    .map((node) => node.id);
}

function intersectionOverUnion(a: BoundingBox, b: BoundingBox): number {
  const xLeft = Math.max(a.x, b.x);
  const yTop = Math.max(a.y, b.y);
  const xRight = Math.min(a.x + a.width, b.x + b.width);
  const yBottom = Math.min(a.y + a.height, b.y + b.height);

  if (xRight <= xLeft || yBottom <= yTop) return 0;

  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
  const unionArea = a.width * a.height + b.width * b.height - intersectionArea;
  if (unionArea <= 0) return 0;
  return intersectionArea / unionArea;
}

function calculateEntryConfidence(ocrMatches: OCRWord[], hasLayoutMatch: boolean): number {
  if (ocrMatches.length === 0) {
    return hasLayoutMatch ? 0.45 : 0.25;
  }

  const averageOcrConfidence = ocrMatches.reduce((sum, match) => sum + match.confidence, 0) / ocrMatches.length;
  const withLayoutBonus = hasLayoutMatch ? averageOcrConfidence + 0.1 : averageOcrConfidence;
  return Math.max(0, Math.min(1, withLayoutBonus));
}

function detectFieldType(path: string, value: unknown): FusionMapEntry["fieldType"] {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("date")) return "date";
  if (
    lowerPath.includes("total") ||
    lowerPath.includes("subtotal") ||
    lowerPath.includes("amount") ||
    lowerPath.includes("price") ||
    lowerPath.includes("tax")
  ) {
    return "currency";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "text";
  return "unknown";
}

function inferTableFusionEntry(input: {
  binding: string;
  rows: Array<Record<string, unknown>>;
  ocrWords: OCRWord[];
  visionLayout: VisionLayout;
}): FusionMapEntry {
  const sampleRows = input.rows.slice(0, 3);
  const firstRow = sampleRows[0] || {};
  const headers = Object.keys(firstRow);

  const tokens = new Set<string>();
  for (const header of headers.slice(0, 12)) {
    tokens.add(header);
    tokens.add(header.replace(/([A-Z])/g, " $1"));
  }

  for (const row of sampleRows) {
    for (const value of Object.values(row).slice(0, 8)) {
      if (typeof value === "string" && value.trim().length > 0) {
        tokens.add(value.trim().slice(0, 40));
      } else if (typeof value === "number") {
        tokens.add(String(value));
      }
    }
  }

  const matchedWordsMap = new Map<string, OCRWord>();
  for (const token of Array.from(tokens).slice(0, 40)) {
    const matches = findMatchingWords(input.ocrWords, token);
    for (const match of matches.slice(0, 12)) {
      matchedWordsMap.set(match.id, match);
    }
  }

  const matchedWords = Array.from(matchedWordsMap.values());
  const tokenBox = combineBoundingBoxes(matchedWords.map((word) => word.boundingBox));

  const tableNode = pickBestTableNode(input.visionLayout.tables, tokenBox);
  const layoutNodeIds = tableNode ? [tableNode.id] : [];
  const mergedBox = mergeBoundingBoxes(tokenBox, tableNode?.boundingBox);

  const ocrConfidence = matchedWords.length > 0
    ? matchedWords.reduce((sum, word) => sum + word.confidence, 0) / matchedWords.length
    : 0;

  const rowSignal = input.rows.length >= 2 ? 0.1 : 0;
  const headerSignal = headers.length >= 3 ? 0.1 : 0;
  const tableNodeSignal = tableNode ? tableNode.confidence * 0.35 : 0;
  const ocrSignal = matchedWords.length > 0 ? ocrConfidence * 0.35 : 0.12;

  const confidence = clamp(0.35 + rowSignal + headerSignal + tableNodeSignal + ocrSignal);

  const entry: FusionMapEntry = {
    binding: input.binding,
    valueText: `array(${input.rows.length})`,
    ocrWordIds: matchedWords.map((word) => word.id),
    layoutNodeIds,
    confidence,
    fieldType: "table",
  };

  if (mergedBox) {
    entry.boundingBox = mergedBox;
  }

  return entry;
}

function pickBestTableNode(
  tables: VisionLayout["tables"],
  tokenBox: BoundingBox | null
): VisionLayout["tables"][number] | undefined {
  if (tables.length === 0) return undefined;
  if (!tokenBox) {
    return tables.slice().sort((a, b) => b.confidence - a.confidence)[0];
  }

  let best: VisionLayout["tables"][number] | undefined;
  let bestScore = -1;

  for (const table of tables) {
    const iou = intersectionOverUnion(table.boundingBox, tokenBox);
    const score = iou * 0.7 + table.confidence * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = table;
    }
  }

  return best;
}

function mergeBoundingBoxes(a: BoundingBox | null, b: BoundingBox | undefined): BoundingBox | null {
  if (!a && !b) return null;
  if (a && !b) return a;
  if (!a && b) return b;
  if (!a || !b) return null;

  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function calculateQuality(input: LayoutFusionInput, fusionMap: FusionMapEntry[]): TemplateQuality {
  const nonTableEntries = fusionMap.filter((entry) => entry.fieldType !== "table");
  const mappedEntries = nonTableEntries.filter((entry) => entry.ocrWordIds.length > 0 || entry.layoutNodeIds.length > 0);

  const layoutCoverage = nonTableEntries.length > 0 ? mappedEntries.length / nonTableEntries.length : 0.5;
  const textConfidence = nonTableEntries.length > 0
    ? nonTableEntries.reduce((sum, entry) => sum + entry.confidence, 0) / nonTableEntries.length
    : 0.5;

  const tableEntries = fusionMap.filter((entry) => entry.fieldType === "table");
  const hasTableData = Object.values(input.extractedData).some((value) => Array.isArray(value));
  const tableQuality = hasTableData
    ? (tableEntries.length > 0
        ? clamp(
            Math.max(
              0.55,
              (tableEntries.reduce((sum, entry) => sum + entry.confidence, 0) / tableEntries.length) * 0.8 +
                Math.max(...tableEntries.map((entry) => entry.confidence)) * 0.2
            )
          )
        : 0.45)
    : 0.9;

  const fontQuality = input.fontMatches.length > 0
    ? input.fontMatches.reduce((sum, match) => sum + match.confidence, 0) / input.fontMatches.length
    : 0.55;

  const layout = clamp(layoutCoverage);
  const text = clamp(textConfidence);
  const table = clamp(tableQuality);
  const font = clamp(fontQuality);

  const overall = clamp(layout * 0.35 + text * 0.3 + table * 0.2 + font * 0.15);

  return { overall, layout, text, table, font };
}

function determineReview(
  quality: TemplateQuality,
  fusionMap: FusionMapEntry[]
): { needsReview: boolean; reviewReasons: string[] } {
  const reasons: string[] = [];

  if (quality.overall < 0.86) {
    reasons.push(`Overall quality below threshold (${quality.overall.toFixed(2)} < 0.86)`);
  }
  if (quality.layout < 0.8) {
    reasons.push(`Layout confidence is low (${quality.layout.toFixed(2)})`);
  }
  if (quality.text < 0.82) {
    reasons.push(`Text alignment confidence is low (${quality.text.toFixed(2)})`);
  }
  if (quality.table < 0.68) {
    reasons.push(`Table detection confidence is low (${quality.table.toFixed(2)})`);
  }
  if (quality.font < 0.7) {
    reasons.push(`Font matching confidence is low (${quality.font.toFixed(2)})`);
  }

  const lowConfidenceBindings = fusionMap
    .filter((entry) => entry.confidence < 0.45 && entry.fieldType !== "table")
    .slice(0, 8)
    .map((entry) => entry.binding);

  if (lowConfidenceBindings.length > 0) {
    reasons.push(`Low-confidence bindings: ${lowConfidenceBindings.join(", ")}`);
  }

  return {
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

let layoutFusionServiceInstance: LayoutFusionService | null = null;

export function getLayoutFusionService(): LayoutFusionService {
  if (!layoutFusionServiceInstance) {
    layoutFusionServiceInstance = new DefaultLayoutFusionService();
  }
  return layoutFusionServiceInstance;
}
