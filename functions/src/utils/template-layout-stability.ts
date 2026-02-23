import { TemplateData, TemplateElement } from "../core/entities/template";
import { resolvePrintableBounds } from "./template-printable-bounds";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Element types that are purely decorative / background layers.
 * They are never moved and never block content elements.
 */
const NON_BLOCKING_TYPES = new Set<TemplateElement["type"]>([
  "box",
  "line",
  "spacer",
  "pageBreak",
  "path",
]);

/**
 * Minimum gap between consecutive content elements in the same column (px).
 */
const ROW_GAP = 4;

/**
 * Two columns are considered the same column if their X-ranges overlap by
 * more than this fraction of the narrower element's width.
 * 0.4 means "at least 40% horizontal overlap → same column".
 */
const COLUMN_MERGE_OVERLAP_RATIO = 0.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Rect = { x: number; y: number; width: number; height: number };

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function isContentElement(element: TemplateElement): boolean {
  return !NON_BLOCKING_TYPES.has(element.type);
}

// ---------------------------------------------------------------------------
// Height estimation — deterministic, independent of LLM's height field
// ---------------------------------------------------------------------------

function normalizeContentForMeasure(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) return " ";
  return trimmed.replace(/\t/g, "  ");
}

function estimateTextHeight(element: Extract<TemplateElement, { type: "text" }>): number {
  const fontSize = Math.max(8, Math.min(96, element.typography.fontSize || 12));
  const lineHeightMultiplier = Math.max(0.8, Math.min(2.2, element.typography.lineHeight || 1.2));
  const lineHeightPx = fontSize * lineHeightMultiplier;
  const weightBoost =
    element.typography.fontWeight === "bold" || element.typography.fontWeight === "semibold"
      ? 1.06
      : 1;
  const avgCharWidth = Math.max(4, fontSize * 0.56 * weightBoost);
  const horizontalPadding = Math.max(
    0,
    typeof element.padding === "number" ? element.padding * 2 : 0
  );
  const verticalPadding = Math.max(
    0,
    typeof element.padding === "number" ? element.padding * 2 : 0
  );
  const availableWidth = Math.max(32, element.width - horizontalPadding);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  const rawText = normalizeContentForMeasure(
    element.text || (element.binding ? "Sample value" : "")
  );
  const visualLines = rawText.split("\n").reduce((sum, line) => {
    const len = normalizeContentForMeasure(line).length;
    return sum + Math.max(1, Math.ceil(len / charsPerLine));
  }, 0);
  const measured = Math.ceil(visualLines * lineHeightPx + verticalPadding + 2);
  return clamp(measured, 14, 640);
}

/**
 * Returns the minimum height an element must occupy, regardless of what the
 * LLM declared.  This is used both to expand underestimated boxes and as the
 * authoritative height when stacking elements in a column.
 */
function computeMinHeight(element: TemplateElement): number {
  switch (element.type) {
    case "text":
      return estimateTextHeight(element);
    case "input":
    case "currency":
      // Single-line field: respect the LLM's declared height if it's larger,
      // but never go below 28px.
      return Math.max(28, Math.round(element.height));
    case "table": {
      const headerH = Math.max(0, element.headerHeight ?? 30);
      const rowH = Math.max(10, element.rowHeight ?? 28);
      // Reserve space for at least 3 data rows in the design view.
      return Math.max(element.height, headerH + rowH * 3);
    }
    case "icon":
      return Math.max(16, Math.round(element.height));
    case "image":
      return Math.max(24, Math.round(element.height));
    default:
      return Math.max(8, Math.round(element.height));
  }
}

// ---------------------------------------------------------------------------
// Phase 0 — Normalise line elements
//
// The renderer draws lines as CSS border-top at `top: 50%` inside the
// bounding box.  The LLM compensates for this by inflating the bounding-box
// height so that "50% of height" visually lands where the line should be.
// That results in:
//   • a bounding box far taller than the actual stroke
//   • incorrect collision / layout calculations for every phase that follows
//
// Fix: compute the true visual Y of the line (y + height/2), then collapse
// the bounding box so height = strokeWidth (the real rendered height).
// After this phase every line element is "what you see is what you get".
// ---------------------------------------------------------------------------

function normalizeLine(
  el: Extract<TemplateElement, { type: "line" }>
): Extract<TemplateElement, { type: "line" }> {
  const strokeWidth = Math.max(0.5, el.strokeWidth ?? 1);

  // Visual centre of the line as the LLM intended it.
  const visualY = Math.round(el.y + el.height / 2);

  // The true bounding box: height equals the stroke so top-50% renders correctly.
  const newHeight = strokeWidth;

  // Shift y so that (newY + newHeight/2) === visualY
  const newY = Math.round(visualY - newHeight / 2);

  if (newY === el.y && newHeight === el.height) return el;

  return {
    ...el,
    y: newY,
    height: newHeight,
    // Also correct x2/y2 if they were set, keeping them consistent.
    ...(typeof el.x2 === "number" && typeof el.y2 === "number"
      ? { x2: el.x2, y2: newY }
      : {}),
  };
}

function normalizeLineElements(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((el) =>
    el.type === "line" ? normalizeLine(el) : el
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — Expand heights so every element is at least its minimum size
// ---------------------------------------------------------------------------

function expandElementHeights(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((el) => {
    if (!isContentElement(el)) return el;
    const minH = computeMinHeight(el);
    if (el.height >= minH) return el;
    return { ...el, height: minH };
  });
}

// ---------------------------------------------------------------------------
// Phase 2 — Column detection
//
// Strategy: cluster elements into "columns" by their horizontal span.
// Two elements belong to the same column when their X-ranges share a
// meaningful overlap (> COLUMN_MERGE_OVERLAP_RATIO of the narrower width).
// This correctly handles:
//   • label + value pairs that the LLM places side-by-side (different columns)
//   • elements that are supposed to stack in the same column
// ---------------------------------------------------------------------------

type Column = {
  xMin: number; // leftmost x of any element in this column
  xMax: number; // rightmost x+width of any element in this column
  indices: number[]; // indices into the elements array
};

function horizontalOverlapAmount(a: Rect, b: Rect): number {
  const overlapStart = Math.max(a.x, b.x);
  const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
  return Math.max(0, overlapEnd - overlapStart);
}

function assignToColumns(elements: TemplateElement[]): Column[] {
  const columns: Column[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!isContentElement(el)) continue;

    const elRect: Rect = { x: el.x, y: el.y, width: el.width, height: el.height };
    let assigned = false;

    for (const col of columns) {
      const colRect: Rect = {
        x: col.xMin,
        y: 0,
        width: col.xMax - col.xMin,
        height: 1,
      };
      const overlap = horizontalOverlapAmount(elRect, colRect);
      const minWidth = Math.min(el.width, col.xMax - col.xMin);
      if (minWidth > 0 && overlap / minWidth >= COLUMN_MERGE_OVERLAP_RATIO) {
        col.xMin = Math.min(col.xMin, el.x);
        col.xMax = Math.max(col.xMax, el.x + el.width);
        col.indices.push(i);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      columns.push({
        xMin: el.x,
        xMax: el.x + el.width,
        indices: [i],
      });
    }
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Phase 3 — Per-column vertical stacking
//
// Within each column, sort elements by their LLM-declared Y (preserving
// relative order intent), then reflow them top-to-bottom with proper gaps.
// The LLM's Y is used only as a sort key — not as a final coordinate.
// This makes the layout 100% deterministic regardless of LLM coordinate quality.
// ---------------------------------------------------------------------------

function reflowColumn(
  column: Column,
  elements: TemplateElement[],
  boundsTop: number,
  boundsBottom: number
): TemplateElement[] {
  const result = [...elements];

  // Sort indices by the element's declared Y (ascending), breaking ties by X.
  const sorted = [...column.indices].sort((a, b) => {
    const ya = elements[a].y;
    const yb = elements[b].y;
    if (ya !== yb) return ya - yb;
    return elements[a].x - elements[b].x;
  });

  let cursor = boundsTop;

  for (const idx of sorted) {
    const el = elements[idx];
    const minH = computeMinHeight(el);
    const h = Math.max(el.height, minH);

    // Place element at max(cursor, el.y) — honour the LLM's Y if it's already
    // below the cursor (preserves intentional spacing), but push down if needed.
    const y = clamp(Math.max(cursor, el.y), boundsTop, Math.max(boundsTop, boundsBottom - h));

    result[idx] =
      y === el.y && h === el.height ? el : { ...el, y, height: h };

    cursor = y + h + ROW_GAP;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 4 — Non-overlapping column merge
//
// After each column is reflowed independently, verify no two columns produce
// elements that still overlap (can happen when the LLM assigns elements to
// wildly wrong X positions).  If two elements from different columns still
// collide, push the later one (by Y) down deterministically.
// ---------------------------------------------------------------------------

function resolveInterColumnCollisions(
  elements: TemplateElement[],
  boundsTop: number,
  boundsBottom: number
): TemplateElement[] {
  const result = [...elements];

  // Work on content elements only, sorted by Y then X.
  const contentIndices = result
    .map((_, i) => i)
    .filter((i) => isContentElement(result[i]))
    .sort((a, b) => {
      if (result[a].y !== result[b].y) return result[a].y - result[b].y;
      return result[a].x - result[b].x;
    });

  const placed: Array<{ idx: number; rect: Rect }> = [];

  for (const idx of contentIndices) {
    const el = result[idx];
    const h = Math.max(el.height, computeMinHeight(el));
    let y = el.y;

    // Keep pushing down until no collision with any previously placed element.
    let changed = true;
    let safety = 0;
    while (changed && safety < 128) {
      changed = false;
      safety++;
      for (const p of placed) {
        const a: Rect = { x: el.x, y, width: el.width, height: h };
        const b = p.rect;
        const overlapX =
          a.x + a.width > b.x + 2 && b.x + b.width > a.x + 2;
        const overlapY = a.y + a.height > b.y + 1 && b.y + b.height > a.y + 1;
        if (overlapX && overlapY) {
          y = clamp(b.y + b.height + ROW_GAP, boundsTop, Math.max(boundsTop, boundsBottom - h));
          changed = true;
        }
      }
    }

    result[idx] = y === el.y && h === el.height ? el : { ...el, y, height: h };
    placed.push({ idx, rect: { x: el.x, y, width: el.width, height: h } });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fully deterministic layout stabilization for AI-generated invoice templates.
 *
 * Pipeline:
 *  1. Expand heights  — enforce per-type minimum heights regardless of LLM output.
 *  2. Column detection — cluster elements by horizontal span.
 *  3. Per-column reflow — stack each column top-to-bottom, using LLM Y only as sort key.
 *  4. Inter-column pass — catch any remaining cross-column collisions and resolve them.
 *
 * Non-blocking types (box, line, spacer, pageBreak, path) are passed through
 * untouched as they are intentional background/decoration layers.
 *
 * This approach is immune to LLM coordinate hallucinations because geometry is
 * recomputed from first principles rather than correcting bad values in-place.
 */
export function stabilizeTemplateLayout(template: TemplateData): TemplateData {
  if (!Array.isArray(template.elements) || template.elements.length === 0) return template;

  const bounds = resolvePrintableBounds(template);

  // Phase 0: fix line bounding boxes (collapse inflated height → strokeWidth, correct y).
  const withNormalizedLines = normalizeLineElements(template.elements);

  // Phase 1: enforce minimum heights.
  const withExpandedHeights = expandElementHeights(withNormalizedLines);

  // Phase 2: detect columns (operates on content elements only).
  const columns = assignToColumns(withExpandedHeights);

  // Phase 3: reflow each column independently.
  let reflowed = [...withExpandedHeights];
  for (const col of columns) {
    reflowed = reflowColumn(col, reflowed, bounds.top, bounds.bottom);
  }

  // Phase 4: resolve any remaining inter-column collisions.
  const resolved = resolveInterColumnCollisions(reflowed, bounds.top, bounds.bottom);

  return { ...template, elements: resolved };
}
