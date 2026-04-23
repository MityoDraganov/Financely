import { TemplateData, TemplateElement } from "../core/entities/template";
import { resolvePrintableBounds } from "./template-printable-bounds";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NON_BLOCKING_TYPES = new Set<TemplateElement["type"]>([
  "box",
  "line",
  "spacer",
  "pageBreak",
  "path",
]);

const ZINDEX_TIER: Record<TemplateElement["type"], number> = {
  box:       0,
  path:      0,
  line:      100,
  spacer:    100,
  pageBreak: 100,
  text:      200,
  input:     200,
  currency:  200,
  image:     200,
  icon:      200,
  table:     200,
  signature: 200,
  barcode:   200,
  qrCode:    200,
  stamp:     200,
  group:     0,
};

/** Minimum gap between stacked elements (px). */
const ROW_GAP = 4;

/**
 * Two elements are considered "side-by-side" (same row) when their LLM-declared
 * Y ranges overlap by more than this fraction of the taller element's height.
 * 0.4 = if they share more than 40% of the taller height → same row.
 */
const SAME_ROW_OVERLAP_RATIO = 0.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Rect = { x: number; y: number; width: number; height: number };

// A "row" is a group of elements that the LLM intended to be side-by-side.
// They share Y-space and are laid out horizontally together.
type Row = { indices: number[] };

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function isContentElement(el: TemplateElement): boolean {
  return !NON_BLOCKING_TYPES.has(el.type);
}

// ---------------------------------------------------------------------------
// Height estimation
// ---------------------------------------------------------------------------

function normalizeContentForMeasure(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) return " ";
  return trimmed.replace(/\t/g, "  ");
}

function estimateTextHeight(el: Extract<TemplateElement, { type: "text" }>): number {
  const fontSize = Math.max(8, Math.min(96, el.typography.fontSize || 12));
  const lineHeightMultiplier = Math.max(0.8, Math.min(2.2, el.typography.lineHeight || 1.2));
  const lineHeightPx = fontSize * lineHeightMultiplier;
  const weightBoost =
    el.typography.fontWeight === "bold" || el.typography.fontWeight === "semibold" ? 1.06 : 1;
  const avgCharWidth = Math.max(4, fontSize * 0.56 * weightBoost);
  const horizontalPadding = Math.max(0, typeof el.padding === "number" ? el.padding * 2 : 0);
  const verticalPadding = Math.max(0, typeof el.padding === "number" ? el.padding * 2 : 0);
  const availableWidth = Math.max(32, el.width - horizontalPadding);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  const rawText = normalizeContentForMeasure(el.text || (el.binding ? "Sample value" : ""));
  const visualLines = rawText.split("\n").reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(normalizeContentForMeasure(line).length / charsPerLine));
  }, 0);
  return clamp(Math.ceil(visualLines * lineHeightPx + verticalPadding + 2), 14, 640);
}

function computeMinHeight(el: TemplateElement): number {
  switch (el.type) {
    case "text":     return estimateTextHeight(el);
    case "input":
    case "currency": return Math.max(28, Math.round(el.height));
    case "table": {
      const headerH = Math.max(0, el.headerHeight ?? 30);
      const rowH    = Math.max(10, el.rowHeight ?? 28);
      return Math.max(el.height, headerH + rowH * 3);
    }
    case "icon":     return Math.max(16, Math.round(el.height));
    case "image":    return Math.max(24, Math.round(el.height));
    default:         return Math.max(8,  Math.round(el.height));
  }
}

// ---------------------------------------------------------------------------
// Phase 0 — Normalise line elements
// ---------------------------------------------------------------------------

function normalizeLine(
  el: Extract<TemplateElement, { type: "line" }>
): Extract<TemplateElement, { type: "line" }> {
  const strokeWidth = Math.max(0.5, el.strokeWidth ?? 1);
  const visualY  = Math.round(el.y + el.height / 2);
  const newHeight = strokeWidth;
  const newY      = Math.round(visualY - newHeight / 2);
  if (newY === el.y && newHeight === el.height) return el;
  return {
    ...el,
    y: newY,
    height: newHeight,
    ...(typeof el.x2 === "number" && typeof el.y2 === "number" ? { x2: el.x2, y2: newY } : {}),
  };
}

function normalizeLineElements(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((el) => (el.type === "line" ? normalizeLine(el) : el));
}

// ---------------------------------------------------------------------------
// Phase 1 — Expand heights to minimum per type
// ---------------------------------------------------------------------------

function expandElementHeights(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((el) => {
    if (!isContentElement(el)) return el;
    const minH = computeMinHeight(el);
    return el.height >= minH ? el : { ...el, height: minH };
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — Group content elements into ROWS
//
// DESIGN
// ------
// We treat the template as a sequence of "rows".  A row is a set of elements
// that are visually side-by-side (they share Y-space in the LLM's output).
// Rows are then stacked top-to-bottom, each row's height equal to the tallest
// element in it.
//
// This single unified pass replaces the old columns + spanning split, which
// caused the two groups to be placed independently and then collide.
//
// ALGORITHM
// ----------
// 1. Sort all content elements by their LLM Y (ascending).  Y is used only
//    as an ordering signal — never as a final position.
// 2. Scan left-to-right through the sorted list.  An incoming element is
//    added to the CURRENT ROW if its LLM Y range overlaps the current row's
//    accumulated Y range by > SAME_ROW_OVERLAP_RATIO of the taller element.
// 3. Otherwise it starts a new row.
//
// This naturally handles both full-width spanning elements (they form a row
// by themselves) and side-by-side column pairs.
// ---------------------------------------------------------------------------

function verticalOverlapRatio(
  ay: number, ah: number,
  by: number, bh: number
): number {
  const overlapStart = Math.max(ay, by);
  const overlapEnd   = Math.min(ay + ah, by + bh);
  const overlap      = Math.max(0, overlapEnd - overlapStart);
  const taller       = Math.max(ah, bh);
  return taller <= 0 ? 0 : overlap / taller;
}

function groupIntoRows(elements: TemplateElement[]): Row[] {
  // Only operate on content elements.
  const contentIndices = elements
    .map((_, i) => i)
    .filter((i) => isContentElement(elements[i]));

  // Sort by LLM Y, breaking ties by X (left-to-right).
  contentIndices.sort((a, b) => {
    if (elements[a].y !== elements[b].y) return elements[a].y - elements[b].y;
    return elements[a].x - elements[b].x;
  });

  const rows: Row[] = [];

  // Track the Y-span of the current row as it accumulates members.
  let rowYMin = 0;
  let rowYMax = 0;

  for (const idx of contentIndices) {
    const el = elements[idx];
    const elY  = el.y;
    const elH  = Math.max(el.height, computeMinHeight(el));

    if (rows.length === 0) {
      rows.push({ indices: [idx] });
      rowYMin = elY;
      rowYMax = elY + elH;
      continue;
    }

    // Does this element share significant vertical overlap with the current row?
    const ratio = verticalOverlapRatio(rowYMin, rowYMax - rowYMin, elY, elH);

    if (ratio >= SAME_ROW_OVERLAP_RATIO) {
      // Same row — extend the row's Y span to include this element.
      rows[rows.length - 1].indices.push(idx);
      rowYMin = Math.min(rowYMin, elY);
      rowYMax = Math.max(rowYMax, elY + elH);
    } else {
      // New row.
      rows.push({ indices: [idx] });
      rowYMin = elY;
      rowYMax = elY + elH;
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Phase 3 — Reflow rows top-to-bottom
//
// Each row is placed at the current cursor position.  The row's height is the
// tallest element in it (after min-height expansion).  Within a row, elements
// keep their LLM-declared X position (we don't touch horizontal layout).
//
// LLM Y values are used ONLY as grouping/sort keys above — they are never
// used as final positions here.
// ---------------------------------------------------------------------------

function reflowRows(
  rows: Row[],
  elements: TemplateElement[],
  boundsTop: number
): TemplateElement[] {
  const result = [...elements];
  let cursor = boundsTop;

  for (const row of rows) {
    // Height of this row = tallest element in it.
    let rowHeight = 0;
    for (const idx of row.indices) {
      const el = result[idx];
      const h = Math.max(el.height, computeMinHeight(el));
      rowHeight = Math.max(rowHeight, h);
    }

    // Place every element in this row at `cursor`.
    // Each element keeps its own height (not forced to rowHeight) but is
    // vertically aligned to the row's top.
    for (const idx of row.indices) {
      const el = result[idx];
      const h = Math.max(el.height, computeMinHeight(el));
      const y = cursor;
      result[idx] = y === el.y && h === el.height ? el : { ...el, y, height: h };
    }

    cursor += rowHeight + ROW_GAP;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 4 — Light collision sweep
//
// After row reflow, elements within the same row are still at the same Y so
// they don't collide vertically.  This sweep catches any cross-row overlaps
// that survive (e.g. unusually tall elements, or misclassified rows).
//
// We push colliding elements DOWN only — no bottom-clamping, to avoid the
// pile-up that was the original bug.
// ---------------------------------------------------------------------------

function resolveCollisions(
  elements: TemplateElement[],
  boundsTop: number
): TemplateElement[] {
  const result = [...elements];

  const contentIndices = result
    .map((_, i) => i)
    .filter((i) => isContentElement(result[i]))
    .sort((a, b) => {
      if (result[a].y !== result[b].y) return result[a].y - result[b].y;
      return result[a].x - result[b].x;
    });

  const placed: Array<{ rect: Rect }> = [];

  for (const idx of contentIndices) {
    const el = result[idx];
    const h = Math.max(el.height, computeMinHeight(el));
    let y = Math.max(el.y, boundsTop);

    let changed = true;
    let safety = 0;
    while (changed && safety < 64) {
      changed = false;
      safety++;
      for (const p of placed) {
        const b = p.rect;
        const overlapX = el.x + el.width > b.x + 1 && b.x + b.width > el.x + 1;
        const overlapY = y + h > b.y + 1 && b.y + b.height > y + 1;
        if (overlapX && overlapY) {
          y = b.y + b.height + ROW_GAP;
          changed = true;
          break;
        }
      }
    }

    result[idx] = y === el.y && h === el.height ? el : { ...el, y, height: h };
    placed.push({ rect: { x: el.x, y, width: el.width, height: h } });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 5 — Deterministic z-index normalisation
// ---------------------------------------------------------------------------

function normalizeZIndexes(elements: TemplateElement[]): TemplateElement[] {
  type Indexed = { idx: number; el: TemplateElement; tier: number; llmZ: number };
  const buckets = new Map<number, Indexed[]>();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const tier = ZINDEX_TIER[el.type] ?? 200;
    const llmZ = el.zIndex ?? 0;
    if (!buckets.has(tier)) buckets.set(tier, []);
    buckets.get(tier)!.push({ idx: i, el, tier, llmZ });
  }

  const result = [...elements];
  for (const [tierBase, items] of buckets) {
    items.sort((a, b) => a.llmZ - b.llmZ);
    items.forEach((item, rank) => {
      const newZ = tierBase + rank;
      if (item.el.zIndex !== newZ) result[item.idx] = { ...item.el, zIndex: newZ };
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deterministic layout stabilization for AI-generated invoice templates.
 *
 * Pipeline:
 *  0. Line normalisation — collapse inflated line heights to strokeWidth.
 *  1. Height expansion   — enforce per-type minimum heights.
 *  2. Row grouping       — sort all content elements by LLM Y, then cluster
 *                          elements that share vertical space into "rows".
 *                          Full-width elements naturally form single-element rows.
 *                          Side-by-side pairs form multi-element rows.
 *                          This is a single unified pass — no separate "columns"
 *                          and "spanning" tracks that later collide.
 *  3. Row reflow         — place each row top-to-bottom from boundsTop.
 *                          LLM Y is used only as a sort/grouping signal;
 *                          final Y positions are 100% recomputed.
 *  4. Collision sweep    — push any still-colliding elements down (no clamp).
 *  5. Z-index normalise  — backgrounds 0–99, separators 100–199, content 200+.
 */
export function stabilizeTemplateLayout(template: TemplateData): TemplateData {
  if (!Array.isArray(template.elements) || template.elements.length === 0) return template;

  const bounds = resolvePrintableBounds(template);

  // Phase 0
  const withNormalizedLines = normalizeLineElements(template.elements);

  // Phase 1
  const withExpandedHeights = expandElementHeights(withNormalizedLines);

  // Phase 2 — group into rows using LLM Y as ordering signal only
  const rows = groupIntoRows(withExpandedHeights);

  // Phase 3 — reflow rows top-to-bottom from boundsTop
  const reflowed = reflowRows(rows, withExpandedHeights, bounds.top);

  // Phase 4 — resolve any remaining collisions
  const resolved = resolveCollisions(reflowed, bounds.top);

  // Phase 5 — fix z-indexes
  const withCorrectZIndexes = normalizeZIndexes(resolved);

  return { ...template, elements: withCorrectZIndexes };
}
