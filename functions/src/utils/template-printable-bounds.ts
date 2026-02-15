import { TemplateData, TemplateElement } from "../core/entities/template";

const DEFAULT_PRINT_MARGINS_PX = { top: 96, right: 96, bottom: 96, left: 96 } as const;
const PAGE_SIZES_PX = {
  A4: { width: 794, height: 1123 },
  Letter: { width: 816, height: 1056 },
  Legal: { width: 816, height: 1344 },
} as const;

export type PrintableBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function asNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function resolvePageDimensionsPx(template: TemplateData): { width: number; height: number } {
  const sizeKey =
    template.pageSettings?.size && template.pageSettings.size !== "Custom"
      ? template.pageSettings.size
      : template.pageSize || "A4";

  const base =
    template.pageSettings?.size === "Custom" && template.pageSettings.customSize
      ? {
          width: Math.max(100, Math.round(template.pageSettings.customSize.width)),
          height: Math.max(100, Math.round(template.pageSettings.customSize.height)),
        }
      : PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX] || PAGE_SIZES_PX.A4;

  if (template.pageSettings?.orientation === "landscape") {
    return { width: base.height, height: base.width };
  }

  return base;
}

function resolveMarginsPx(template: TemplateData): { top: number; right: number; bottom: number; left: number } {
  const source = template.pageSettings?.margins || template.brand?.margins || DEFAULT_PRINT_MARGINS_PX;
  return {
    top: asNonNegativeNumber(source.top, DEFAULT_PRINT_MARGINS_PX.top),
    right: asNonNegativeNumber(source.right, DEFAULT_PRINT_MARGINS_PX.right),
    bottom: asNonNegativeNumber(source.bottom, DEFAULT_PRINT_MARGINS_PX.bottom),
    left: asNonNegativeNumber(source.left, DEFAULT_PRINT_MARGINS_PX.left),
  };
}

export function resolvePrintableBounds(template: TemplateData): PrintableBounds {
  const page = resolvePageDimensionsPx(template);
  const margins = resolveMarginsPx(template);

  let left = clamp(margins.left, 0, page.width - 1);
  let top = clamp(margins.top, 0, page.height - 1);
  let right = clamp(page.width - margins.right, left + 1, page.width);
  let bottom = clamp(page.height - margins.bottom, top + 1, page.height);

  if (right <= left) {
    left = 0;
    right = page.width;
  }
  if (bottom <= top) {
    top = 0;
    bottom = page.height;
  }

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function clampLineToBounds(
  element: Extract<TemplateElement, { type: "line" }>,
  bounds: PrintableBounds
): Extract<TemplateElement, { type: "line" }> {
  let x1 = clamp(Math.round(element.x), bounds.left, bounds.right);
  let y1 = clamp(Math.round(element.y), bounds.top, bounds.bottom);
  let x2 = clamp(Math.round(element.x2), bounds.left, bounds.right);
  let y2 = clamp(Math.round(element.y2), bounds.top, bounds.bottom);

  if (x1 === x2 && y1 === y2) {
    if (x2 < bounds.right) x2 = x2 + 1;
    else if (x1 > bounds.left) x1 = x1 - 1;
  }

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const width = Math.max(1, Math.abs(x2 - x1));
  const height = Math.max(1, Math.abs(y2 - y1));

  return {
    ...element,
    x: minX,
    y: minY,
    x2,
    y2,
    width,
    height,
  };
}

function clampBoxToBounds(
  element: TemplateElement,
  bounds: PrintableBounds
): TemplateElement {
  const minSize = element.type === "line" ? 1 : 8;
  const rawWidth = asNonNegativeNumber(element.width, minSize);
  const rawHeight = asNonNegativeNumber(element.height, minSize);
  const width = clamp(Math.round(rawWidth), minSize, Math.max(minSize, Math.floor(bounds.width)));
  const height = clamp(Math.round(rawHeight), minSize, Math.max(minSize, Math.floor(bounds.height)));
  const x = clamp(Math.round(element.x), bounds.left, bounds.right - width);
  const y = clamp(Math.round(element.y), bounds.top, bounds.bottom - height);

  if (element.type === "line") {
    return clampLineToBounds(
      {
        ...element,
        x,
        y,
        width,
        height,
      },
      bounds
    );
  }

  return {
    ...element,
    x,
    y,
    width,
    height,
  };
}

export function clampTemplateElementsToPrintableArea(template: TemplateData): TemplateData {
  if (!Array.isArray(template.elements) || template.elements.length === 0) {
    return template;
  }

  const bounds = resolvePrintableBounds(template);
  const clampedElements = template.elements.map((element) => clampBoxToBounds(element, bounds));

  return {
    ...template,
    elements: clampedElements,
  };
}
