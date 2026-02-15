import { TemplateData, TemplateElement } from "../core/entities/template";
import { resolvePrintableBounds } from "./template-printable-bounds";

const NON_BLOCKING_TYPES = new Set<TemplateElement["type"]>([
  "box",
  "line",
  "spacer",
  "pageBreak",
]);

type Rect = { x: number; y: number; width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function intersects(a: Rect, b: Rect, tolerance = 0): boolean {
  return (
    a.x + a.width > b.x + tolerance &&
    b.x + b.width > a.x + tolerance &&
    a.y + a.height > b.y + tolerance &&
    b.y + b.height > a.y + tolerance
  );
}

function isTextBearingElement(
  element: TemplateElement
): element is Extract<TemplateElement, { type: "text" | "input" | "currency" }> {
  return element.type === "text" || element.type === "input" || element.type === "currency";
}

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
    element.typography.fontWeight === "bold" || element.typography.fontWeight === "semibold" ? 1.06 : 1;
  const avgCharWidth = Math.max(4, fontSize * 0.56 * weightBoost);
  const horizontalPadding = Math.max(0, typeof element.padding === "number" ? element.padding * 2 : 0);
  const verticalPadding = Math.max(0, typeof element.padding === "number" ? element.padding * 2 : 0);
  const availableWidth = Math.max(32, element.width - horizontalPadding);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  const rawText = normalizeContentForMeasure(element.text || (element.binding ? "Sample value" : ""));
  const visualLines = rawText.split("\n").reduce((sum, line) => {
    const len = normalizeContentForMeasure(line).length;
    return sum + Math.max(1, Math.ceil(len / charsPerLine));
  }, 0);
  const measured = Math.ceil(visualLines * lineHeightPx + verticalPadding + 2);
  return clamp(measured, 14, 640);
}

function estimateMinHeight(element: TemplateElement): number {
  if (element.type === "text") return estimateTextHeight(element);
  if (element.type === "input") return 32;
  if (element.type === "currency") return 32;
  return Math.max(8, Math.round(element.height));
}

function expandElementHeights(template: TemplateData): TemplateElement[] {
  return template.elements.map((element) => {
    if (!isTextBearingElement(element)) return element;
    const minHeight = estimateMinHeight(element);
    if (element.height >= minHeight) return element;
    return {
      ...element,
      height: minHeight,
    };
  });
}

function shouldParticipateInCollisionFlow(element: TemplateElement): boolean {
  return !NON_BLOCKING_TYPES.has(element.type);
}

function resolveVerticalCollisions(template: TemplateData, gap = 4): TemplateElement[] {
  const bounds = resolvePrintableBounds(template);
  const elements = [...template.elements];
  const ordered = elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      if (a.element.y !== b.element.y) return a.element.y - b.element.y;
      if (a.element.x !== b.element.x) return a.element.x - b.element.x;
      return a.index - b.index;
    });

  const placed: Array<{ id: string; rect: Rect; type: TemplateElement["type"] }> = [];

  for (const item of ordered) {
    const source = elements[item.index];
    if (!shouldParticipateInCollisionFlow(source)) {
      placed.push({
        id: source.id,
        type: source.type,
        rect: { x: source.x, y: source.y, width: source.width, height: source.height },
      });
      continue;
    }

    const maxY = Math.max(bounds.top, bounds.bottom - source.height);
    let nextY = clamp(source.y, bounds.top, maxY);
    const currentRect: Rect = { x: source.x, y: nextY, width: source.width, height: source.height };

    let safety = 0;
    while (safety < 64) {
      safety += 1;
      const blockingBottoms = placed
        .filter((entry) => !NON_BLOCKING_TYPES.has(entry.type))
        .filter((entry) => intersects(currentRect, entry.rect, 1))
        .map((entry) => entry.rect.y + entry.rect.height + gap);

      if (blockingBottoms.length === 0) break;
      const candidateY = Math.max(...blockingBottoms);
      if (candidateY <= nextY) break;

      nextY = clamp(candidateY, bounds.top, maxY);
      currentRect.y = nextY;

      if (nextY >= maxY) break;
    }

    elements[item.index] = nextY === source.y ? source : { ...source, y: nextY };
    placed.push({
      id: elements[item.index].id,
      type: elements[item.index].type,
      rect: {
        x: elements[item.index].x,
        y: elements[item.index].y,
        width: elements[item.index].width,
        height: elements[item.index].height,
      },
    });
  }

  return elements;
}

/**
 * Stabilizes AI-generated layouts by expanding underestimated text-bearing boxes
 * and by preventing non-background elements from overlapping vertically.
 * Box/line/spacer/pageBreak elements are treated as non-blocking overlays.
 */
export function stabilizeTemplateLayout(template: TemplateData): TemplateData {
  if (!Array.isArray(template.elements) || template.elements.length === 0) return template;

  const expanded = expandElementHeights(template);
  const collided = resolveVerticalCollisions({ ...template, elements: expanded });
  return {
    ...template,
    elements: collided,
  };
}
