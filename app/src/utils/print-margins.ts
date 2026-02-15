export type MarginUnit = "in" | "cm";

export type MarginBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const PX_PER_INCH = 96;
export const CM_PER_INCH = 2.54;
export const DEFAULT_PRINT_MARGIN_IN = 1;
export const DEFAULT_PRINT_MARGIN_PX = PX_PER_INCH * DEFAULT_PRINT_MARGIN_IN;
export const DEFAULT_MARGIN_UNIT: MarginUnit = "in";
export const DEFAULT_PRINT_MARGINS_PX: MarginBox = {
  top: DEFAULT_PRINT_MARGIN_PX,
  right: DEFAULT_PRINT_MARGIN_PX,
  bottom: DEFAULT_PRINT_MARGIN_PX,
  left: DEFAULT_PRINT_MARGIN_PX,
};

export function getDefaultPrintMarginsPx(): MarginBox {
  return { ...DEFAULT_PRINT_MARGINS_PX };
}

function normalizeMarginValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

export function resolveTemplateMarginsPx(
  pageMargins?: Partial<MarginBox> | null,
  brandMargins?: Partial<MarginBox> | null
): MarginBox {
  const fallback = DEFAULT_PRINT_MARGINS_PX;
  if (pageMargins) {
    return {
      top: normalizeMarginValue(pageMargins.top, fallback.top),
      right: normalizeMarginValue(pageMargins.right, fallback.right),
      bottom: normalizeMarginValue(pageMargins.bottom, fallback.bottom),
      left: normalizeMarginValue(pageMargins.left, fallback.left),
    };
  }
  if (brandMargins) {
    return {
      top: normalizeMarginValue(brandMargins.top, fallback.top),
      right: normalizeMarginValue(brandMargins.right, fallback.right),
      bottom: normalizeMarginValue(brandMargins.bottom, fallback.bottom),
      left: normalizeMarginValue(brandMargins.left, fallback.left),
    };
  }
  return { ...fallback };
}

export function marginUnitToPx(value: number, unit: MarginUnit): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === "cm") return (value / CM_PER_INCH) * PX_PER_INCH;
  return value * PX_PER_INCH;
}

export function pxToMarginUnit(px: number, unit: MarginUnit): number {
  if (!Number.isFinite(px)) return 0;
  if (unit === "cm") return (px / PX_PER_INCH) * CM_PER_INCH;
  return px / PX_PER_INCH;
}
