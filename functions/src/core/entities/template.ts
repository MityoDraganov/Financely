import z from "zod";
import { baseEntitySchema } from "./base";

export const templateElementBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "text",
    "image",
    "table",
    "box",
    "line",
    "input",
    "currency",
    "icon",
    "spacer",
    "pageBreak",
    "qrCode",
    "barcode",
    "signature",
    "stamp",
    "path", // SVG path for curved/complex shapes
    "group", // Group container (visual only, not rendered)
  ]),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  rotation: z.number().default(0),
  zIndex: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
  locked: z.boolean().optional(),
  groupId: z.string().optional(),
});

const spacingSchema = z.object({
  top: z.number().min(0).max(200).default(0),
  right: z.number().min(0).max(200).default(0),
  bottom: z.number().min(0).max(200).default(0),
  left: z.number().min(0).max(200).default(0),
});

const borderSchema = z.object({
  width: z.number().min(0).max(24).default(0),
  color: z.string().default("#d1d5db"),
  style: z.enum(["solid", "dashed", "dotted", "double", "groove", "ridge"]).default("solid"),
  radius: z.number().min(0).max(200).default(0),
});

const shadowSchema = z.object({
  enabled: z.boolean().default(false),
  blur: z.number().min(0).max(80).default(4),
  offsetX: z.number().min(-50).max(50).default(0),
  offsetY: z.number().min(-50).max(50).default(2),
  spread: z.number().min(-20).max(40).default(0),
  color: z.string().default("#00000040"),
});

const pathNodeHandleSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const pathNodeSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  type: z.enum(["corner", "smooth", "symmetric"]).optional(),
  handleType: z.enum(["corner", "smooth", "symmetric"]).optional(),
  handleIn: pathNodeHandleSchema.nullable().optional(),
  handleOut: pathNodeHandleSchema.nullable().optional(),
  cornerRadius: z.number().min(0).max(200).default(0),
}).transform((node) => ({
  ...node,
  handleType: node.handleType ?? node.type ?? "corner",
}));

const pathSubpathSchema = z.object({
  id: z.string().min(1),
  closed: z.boolean().default(false),
  nodes: z.array(pathNodeSchema).default([]),
});

export const textElementSchema = templateElementBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().default(""),
  binding: z.string().optional(),
  calc: z.string().optional(),
  typography: z.object({
    fontFamily: z.string().default("Inter"),
    fontSize: z.number().min(6).max(200).default(12),
    fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).default("normal"),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    lineHeight: z.number().min(0.8).max(3).default(1.2),
    letterSpacing: z.number().min(-2).max(30).default(0),
    wordSpacing: z.number().min(-2).max(40).optional(),
    color: z.string().default("#111827"),
    align: z.enum(["left", "center", "right", "justify"]).default("left"),
    uppercase: z.boolean().default(false),
    lowercase: z.boolean().default(false),
    textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
    textIndent: z.number().min(0).max(160).optional(),
  }),
  // Enhanced styling options
  backgroundColor: z.string().optional(), // Background color for text element
  padding: z.number().min(0).max(200).optional(), // Legacy text padding (deprecated; use paddingStyle)
  opacity: z.number().min(0).max(1).default(1), // Opacity (0-1)
  shadow: shadowSchema.optional(),
  format: z
    .object({
      kind: z.enum(["none", "currency", "date"]).default("none"),
      currency: z.string().optional(),
      dateFormat: z.string().optional(),
    })
    .default({ kind: "none" }),
});

export const imageElementSchema = templateElementBaseSchema.extend({
  type: z.literal("image"),
  src: z.string().default(""),
  binding: z.string().optional(),
  objectFit: z.enum(["contain", "cover", "fill", "none", "scale-down"]).default("contain"),
  objectPosition: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
  filter: z.object({
    blur: z.number().min(0).max(20).default(0),
    brightness: z.number().min(0).max(3).default(1),
    contrast: z.number().min(0).max(3).default(1),
    grayscale: z.number().min(0).max(1).default(0),
  }).optional(),
  overlay: z.object({
    color: z.string(),
    opacity: z.number().min(0).max(1).default(0),
  }).optional(),
  padding: spacingSchema.optional(),
  margin: spacingSchema.optional(),
  shape: z.enum(["rectangle", "circle", "custom"]).optional(),
  clipPath: z.string().optional(),
  link: z.string().optional(),
  alt: z.string().optional(),
});

export const boxElementSchema = templateElementBaseSchema.extend({
  type: z.literal("box"),
  fill: z.string().default("#ffffff00"),
  shape: z.enum(["rectangle", "circle", "triangle", "polygon", "custom"]).optional(),
  points: z.number().int().min(3).max(24).optional(),
  clipPath: z.string().optional(),
  // Gradient support (if fillGradient is set, it overrides fill)
  fillGradient: z.object({
    type: z.enum(["linear", "radial"]).default("linear"),
    colors: z.array(z.string()).min(2).max(4), // Array of color stops
    angle: z.number().min(0).max(360).default(90), // For linear gradients
  }).optional(),
  stroke: z.string().default("#e5e7eb"),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  strokeWidth: z.number().min(0).max(50).default(1),
  radius: z.number().min(0).max(500).default(0),
  opacity: z.number().min(0).max(1).default(1), // Opacity (0-1)
  shadow: shadowSchema.optional(),
});

export const lineElementSchema = templateElementBaseSchema.extend({
  type: z.literal("line"),
  x2: z.number().min(0),
  y2: z.number().min(0),
  stroke: z.string().default("#e5e7eb"),
  strokeWidth: z.number().min(0.5).max(10).default(1),
  style: z.enum(["solid", "dashed", "dotted", "double", "groove", "ridge"]).optional(),
  pattern: z.enum(["line", "wave", "zigzag", "dots", "custom"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  gradient: z.object({
    start: z.string(),
    end: z.string(),
    angle: z.number().min(0).max(360).default(90),
  }).optional(),
  shadow: shadowSchema.optional(),
});

export const iconElementSchema = templateElementBaseSchema.extend({
  type: z.literal("icon"),
  iconName: z.string().min(1).default("file-text"),
  library: z.enum(["lucide", "fontawesome", "material", "custom"]).optional(),
  customIconUrl: z.string().optional(),
  color: z.string().default("#111827"),
  backgroundColor: z.string().optional(),
  padding: z.number().min(0).max(64).optional(),
  border: borderSchema.optional(),
  shape: z.enum(["none", "circle", "square", "rounded"]).optional(),
  flip: z.enum(["none", "horizontal", "vertical", "both"]).optional(),
  effect: z.enum(["none", "shadow", "glow", "outline"]).optional(),
  link: z.string().optional(),
  tooltip: z.string().optional(),
});

export const inputElementSchema = templateElementBaseSchema.extend({
  type: z.literal("input"),
  placeholder: z.string().default(""),
  binding: z.string().optional(),
  variant: z.enum(["text", "number", "date"]).default("text"),
  align: z.enum(["left", "center", "right"]).default("left"),
  fontFamily: z.string().optional(),
});

export const currencyElementSchema = templateElementBaseSchema.extend({
  type: z.literal("currency"),
  placeholder: z.string().default(""),
  binding: z.string().optional(),
  currency: z.string().length(3).default("USD"), // ISO 4217 currency code (e.g., "USD", "EUR")
  currencyLinks: z.array(z.object({
    id: z.string().min(1),
    sourceFieldId: z.string().min(1),
    linkType: z.enum(["FX_PAIR", "FIXED_MULTIPLIER", "FORMULA"]),
    targetCurrency: z.string().length(3).optional(),
    multiplier: z.number().optional(),
    formula: z.string().optional(),
    rateSource: z.enum(["api", "manual"]).optional(),
    rateDate: z.string().optional(),
    rate: z.number().optional(),
  })).default([]),
  mode: z.enum(["independent", "linked", "formula"]).default("independent"),
  formula: z.string().optional(), // Formula for formula mode (Excel-like syntax)
  align: z.enum(["left", "center", "right"]).default("left"),
  fontFamily: z.string().optional(),
});

export const tableColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string().default("Column"),
  width: z.union([z.string().min(1), z.number().positive()]).default("1fr"),
  align: z.enum(["left", "center", "right"]).default("left"),
  type: z.enum(["text", "number", "date", "currency"]).default("text"),
  binding: z.string().optional(),
  calc: z.string().optional(),
  format: z
    .object({
      kind: z.enum(["none", "currency", "date"]).default("none"),
      currency: z.string().optional(),
      dateFormat: z.string().optional(),
    })
    .default({ kind: "none" }),
  // Currency-specific fields (similar to currency element)
  currency: z.string().length(3).optional(), // ISO 4217 currency code (e.g., "USD", "EUR")
  currencyLinks: z.array(z.object({
    id: z.string().min(1),
    sourceFieldId: z.string().min(1),
    linkType: z.enum(["FX_PAIR", "FIXED_MULTIPLIER", "FORMULA"]),
    targetCurrency: z.string().length(3).optional(),
    multiplier: z.number().optional(),
    formula: z.string().optional(),
    rateSource: z.enum(["api", "manual"]).optional(),
    rateDate: z.string().optional(),
    rate: z.number().optional(),
  })).optional(), // Field linking configuration
  mode: z.enum(["independent", "linked", "formula"]).optional(), // Field mode
  // Total row configuration (only for number/currency columns)
  showTotal: z.boolean().default(false),
  totalStyle: z
    .object({
      backgroundColor: z.string().optional(),
      fontWeight: z.enum(["normal", "bold", "600", "700"]).default("bold"),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      borderTop: z.string().optional(),
    })
    .optional(),
});

const tableTextBehaviorSchema = z.object({
  mode: z.enum(["wrap", "nowrap", "break-words", "ellipsis", "clamp"]).default("wrap"),
  clampLines: z.number().int().min(1).max(10).optional(),
});

const tableTypographyStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  color: z.string().optional(),
  textBehavior: tableTextBehaviorSchema.optional(),
});

export const tableElementSchema = templateElementBaseSchema.extend({
  type: z.literal("table"),
  rowHeight: z.number().min(10).max(200).default(28),
  headerHeight: z.number().min(0).max(200).default(28),
  stripe: z.boolean().default(false),
  columns: z.array(tableColumnSchema).default([]),
  itemsBinding: z.string().default("items"),
  // Design-time sample rows for the designer preview (not used at runtime)
  designRows: z
    .array(
      z.object({
        id: z.string().min(1),
        values: z.record(z.string(), z.string()).default({}),
      }),
    )
    .default([]),
  headerStyle: tableTypographyStyleSchema.optional(),
  rowStyle: tableTypographyStyleSchema.optional(),
  footerStyle: z.object({
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
    color: z.string().optional(),
  }).optional(),
  headerBackground: z.string().optional(),
  rowBackground: z.string().optional(),
  alternateRowBackground: z.string().optional(),
  footerBackground: z.string().optional(),
  borderStyle: z.enum(["none", "rows", "columns", "all", "outer"]).optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().min(0).max(10).optional(),
  cellPadding: spacingSchema.optional(),
  shadow: shadowSchema.optional(),
  showFooter: z.boolean().optional(),
});

export const spacerElementSchema = templateElementBaseSchema.extend({
  type: z.literal("spacer"),
  showDivider: z.boolean().default(false),
  dividerStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  dividerColor: z.string().default("#d1d5db"),
  dividerWidth: z.number().min(0).max(10).default(1),
});

export const pageBreakElementSchema = templateElementBaseSchema.extend({
  type: z.literal("pageBreak"),
  breakType: z.enum(["always", "avoid", "auto"]).default("always"),
  showInEditor: z.boolean().default(true),
  style: z.enum(["line", "dashed", "none"]).default("dashed"),
});

export const qrCodeElementSchema = templateElementBaseSchema.extend({
  type: z.literal("qrCode"),
  content: z.string().default(""),
  binding: z.string().optional(),
  dataType: z.enum(["url", "text", "payment", "custom"]).default("text"),
  foregroundColor: z.string().default("#111827"),
  backgroundColor: z.string().default("#ffffff"),
  errorCorrection: z.enum(["low", "medium", "high", "ultra"]).default("medium"),
  margin: z.number().min(0).max(32).default(2),
  border: borderSchema.optional(),
  logo: z.object({
    show: z.boolean().default(false),
    image: z.string().optional(),
    size: z.number().min(8).max(120).default(24),
  }).optional(),
});

export const barcodeElementSchema = templateElementBaseSchema.extend({
  type: z.literal("barcode"),
  value: z.string().default(""),
  binding: z.string().optional(),
  format: z.enum(["CODE128", "CODE39", "EAN13", "UPC"]).default("CODE128"),
  color: z.string().default("#111827"),
  backgroundColor: z.string().default("#ffffff"),
  showText: z.boolean().default(true),
  textPosition: z.enum(["top", "bottom"]).default("bottom"),
});

export const signatureElementSchema = templateElementBaseSchema.extend({
  type: z.literal("signature"),
  signatureType: z.enum(["placeholder", "image", "drawn"]).default("placeholder"),
  signatureImage: z.string().optional(),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  showDate: z.boolean().default(false),
  borderBottom: z.object({
    width: z.number().min(0).max(8).default(1),
    color: z.string().default("#111827"),
    style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  }).optional(),
  placeholderText: z.string().default("Signature"),
});

export const stampElementSchema = templateElementBaseSchema.extend({
  type: z.literal("stamp"),
  text: z.string().default("PAID"),
  stampType: z.enum(["paid", "overdue", "draft", "void", "custom"]).default("paid"),
  shape: z.enum(["rectangle", "circle", "badge", "custom"]).default("rectangle"),
  size: z.number().min(20).max(500).default(120),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().min(8).max(120).default(24),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).default("bold"),
  textColor: z.string().default("#991b1b"),
  backgroundColor: z.string().default("#fee2e2"),
  border: borderSchema.optional(),
  opacity: z.number().min(0).max(1).default(0.85),
  effect: z.enum(["stamped", "embossed", "flat"]).default("stamped"),
  pattern: z.enum(["diagonal-lines", "dots", "none"]).default("none"),
});

export const pathElementSchema = templateElementBaseSchema.extend({
  type: z.literal("path"),
  // SVG path data (d attribute) - supports all SVG path commands (M, L, C, Q, A, Z, etc.)
  pathData: z.string().min(1),
  subpaths: z.array(pathSubpathSchema).optional(),
  // Fill color (supports gradients via fillGradient)
  fill: z.string().default("#3b82f6"),
  fillGradient: z.object({
    type: z.enum(["linear", "radial"]).default("linear"),
    colors: z.array(z.string()).min(2).max(4),
    angle: z.number().min(0).max(360).default(90),
  }).optional(),
  // Stroke properties
  stroke: z.string().optional(),
  strokeWidth: z.number().min(0).max(20).default(0),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  strokeLinecap: z.enum(["butt", "round", "square"]).optional(),
  strokeLinejoin: z.enum(["miter", "round", "bevel"]).optional(),
  // Path-specific styling
  opacity: z.number().min(0).max(1).default(1),
  fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
  // Shadow support
  shadow: shadowSchema.optional(),
  // Blend mode for layering effects
  blendMode: z.enum(["normal", "multiply", "screen", "overlay", "darken", "lighten"]).optional(),
  scaleStroke: z.boolean().default(false),
});

export const groupElementSchema = templateElementBaseSchema.extend({
  type: z.literal("group"),
  label: z.string().optional(),
});

export const templateElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  tableElementSchema,
  boxElementSchema,
  lineElementSchema,
  iconElementSchema,
  inputElementSchema,
  currencyElementSchema,
  spacerElementSchema,
  pageBreakElementSchema,
  qrCodeElementSchema,
  barcodeElementSchema,
  signatureElementSchema,
  stampElementSchema,
  pathElementSchema,
  groupElementSchema,
]);

export type TemplateElement = z.infer<typeof templateElementSchema>;

export const templateWatermarkSchema = z.object({
  enabled: z.boolean().default(false),
  imageUrl: z.string().optional(), // URL to the watermark image
  text: z.string().optional(), // Text watermark (alternative to image)
  position: z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right", "top-center", "bottom-center", "left-center", "right-center"]).default("center"),
  x: z.number().optional(), // Custom X position in pixels (overrides position)
  y: z.number().optional(), // Custom Y position in pixels (overrides position)
  width: z.number().min(50).max(1000).default(200), // Watermark width in pixels
  height: z.number().min(50).max(1000).optional(), // Watermark height in pixels (maintains aspect ratio if not set)
  rotation: z.number().min(-180).max(180).default(0), // Rotation in degrees
  opacity: z.number().min(0).max(1).default(0.1), // Opacity (0-1)
  blendMode: z.enum(["normal", "multiply", "screen", "overlay", "soft-light", "hard-light"]).default("normal"),
  repeat: z.enum(["none", "repeat", "repeat-x", "repeat-y"]).default("none"), // For tiling watermarks
});

export const templateBrandSchema = z.object({
  fonts: z.array(z.string()).default(["Inter"]),
  colors: z
    .object({
      primary: z.string().default("#111827"),
      secondary: z.string().default("#6b7280"),
      accent: z.string().default("#2563eb"),
    })
    .default({ primary: "#111827", secondary: "#6b7280", accent: "#2563eb" }),
  margins: z
    .object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
    .default({ top: 96, right: 96, bottom: 96, left: 96 }),
  backgroundImage: z.string().optional(),
  watermark: templateWatermarkSchema.optional(),
});

export const templatePageSettingsSchema = z.object({
  size: z.enum(["A4", "Letter", "Legal", "Custom"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  customSize: z.object({
    width: z.number().min(100).max(5000),
    height: z.number().min(100).max(5000),
  }).optional(),
  margins: spacingSchema.default({ top: 96, right: 96, bottom: 96, left: 96 }),
  marginUnit: z.enum(["in", "cm"]).default("in"),
  padding: spacingSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
});

export const templateThemeSchema = z.object({
  colors: z.object({
    primary: z.string().default("#111827"),
    secondary: z.string().default("#6b7280"),
    accent: z.string().default("#2563eb"),
    text: z.string().default("#111827"),
    muted: z.string().default("#9ca3af"),
    error: z.string().default("#dc2626"),
    success: z.string().default("#16a34a"),
  }).default({
    primary: "#111827",
    secondary: "#6b7280",
    accent: "#2563eb",
    text: "#111827",
    muted: "#9ca3af",
    error: "#dc2626",
    success: "#16a34a",
  }),
  fonts: z.object({
    primary: z.string().default("Inter"),
    secondary: z.string().default("Inter"),
    mono: z.string().default("ui-monospace"),
  }).default({ primary: "Inter", secondary: "Inter", mono: "ui-monospace" }),
  radii: z.object({
    sm: z.number().default(4),
    md: z.number().default(8),
    lg: z.number().default(12),
  }).default({ sm: 4, md: 8, lg: 12 }),
  shadows: z.object({
    sm: z.string().default("0 1px 2px rgba(0,0,0,0.08)"),
    md: z.string().default("0 4px 10px rgba(0,0,0,0.14)"),
    lg: z.string().default("0 12px 28px rgba(0,0,0,0.18)"),
  }).default({
    sm: "0 1px 2px rgba(0,0,0,0.08)",
    md: "0 4px 10px rgba(0,0,0,0.14)",
    lg: "0 12px 28px rgba(0,0,0,0.18)",
  }),
});

export const templateRepeatingSchema = z.object({
  header: z.object({
    enabled: z.boolean().default(false),
    height: z.number().min(0).max(500).default(80),
    showOnFirstPage: z.boolean().default(true),
    showOnAllPages: z.boolean().default(true),
  }).optional(),
  footer: z.object({
    enabled: z.boolean().default(false),
    height: z.number().min(0).max(500).default(80),
    showOnFirstPage: z.boolean().default(true),
    showOnAllPages: z.boolean().default(true),
    pageNumbers: z.object({
      enabled: z.boolean().default(false),
      format: z.string().default("Page {page} of {total}"),
      position: z.enum(["left", "center", "right"]).default("right"),
    }).optional(),
  }).optional(),
});

export const templateReferenceLayerSchema = z.object({
  assetUrl: z.string(),
  opacity: z.number().min(0).max(1).default(0.3),
  visible: z.boolean().default(true),
  locked: z.boolean().default(true),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  scale: z.number().min(0.1).max(10).default(1),
  rotation: z.number().default(0),
});

const invoiceBlockTypeSchema = z.enum([
  "companySender",
  "customerRecipient",
  "invoiceDetails",
  "lineItems",
  "totals",
  "paymentTerms",
  "notesTerms",
  "container",
  "columns",
  "spacer",
  "pageBreak",
  "text",
  "image",
  "divider",
  "shape",
  "qrCode",
  "barcode",
  "signature",
  "stamp",
  "icon",
  "table",
]);

type InvoiceBlockNode = {
  id: string;
  type: z.infer<typeof invoiceBlockTypeSchema>;
  props?: Record<string, unknown>;
  children?: InvoiceBlockNode[];
  columns?: Array<{
    id: string;
    width?: number;
    children?: InvoiceBlockNode[];
  }>;
};

export const invoiceBlockSchema: z.ZodType<InvoiceBlockNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: invoiceBlockTypeSchema,
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(invoiceBlockSchema).optional(),
    columns: z.array(z.object({
      id: z.string().min(1),
      width: z.number().min(0).max(100).optional(),
      children: z.array(invoiceBlockSchema).default([]),
    })).optional(),
  })
);

export type InvoiceBlock = z.infer<typeof invoiceBlockSchema>;

export const templateComplianceMetadataSchema = z.object({
  // Target region for this template (determines which compliance schema applies)
  region: z.enum(["US", "EU", "CA", "AU", "UK"]).optional(),
  // Required field bindings that must be present in the template
  requiredFields: z.array(z.string()).default([]), // Array of binding paths (e.g., ["invoiceNumber", "seller.name"])
  // Whether to auto-inject compliance footer
  autoFooter: z.boolean().default(true),
  // Custom footer text (overrides auto-generated)
  customFooter: z.string().optional(),
  // Whether template has been validated for compliance
  complianceValidated: z.boolean().default(false),
  // Last compliance validation timestamp
  complianceValidatedAt: z.string().optional(),
});

/**
 * Product table column mapping configuration
 * Defines how product entity fields map to invoice table columns
 */
export const productTableColumnMappingSchema = z.object({
  // The table column binding (e.g., "description", "unitPrice", "quantity")
  columnBinding: z.string().min(1),
  // The product field to map from (e.g., "name", "description", "price", "sku")
  productField: z.enum([
    "name",
    "description",
    "price",
    "currency",
    "sku",
    "barcode",
    "category",
    "taxRate",
    "cost",
  ]),
  // Optional transformation function
  transform: z.enum(["none", "currency_convert", "format_number"]).default("none"),
  // For currency conversion: target currency (if different from product currency)
  targetCurrency: z.string().length(3).optional(),
  // Whether this field should be locked when product is selected
  lockOnProductSelect: z.boolean().default(true),
});

/**
 * Product table configuration for invoice templates
 * Pre-defines how products map to invoice table rows
 */
export const productTableConfigSchema = z.object({
  // The items binding path for the table (e.g., "items", "lineItems")
  itemsBinding: z.string().min(1),
  // Column mappings: product fields -> table columns
  columnMappings: z.array(productTableColumnMappingSchema).default([]),
  // Whether to auto-populate quantity (default: false, user sets manually)
  autoQuantity: z.boolean().default(false),
  // Default quantity if autoQuantity is true
  defaultQuantity: z.number().min(0).default(1),
  // Whether to convert currency automatically if product currency differs from table currency
  autoConvertCurrency: z.boolean().default(true),
  // Default currency for the table (used if column doesn't specify)
  defaultCurrency: z.string().length(3).default("USD"),
});

export type ProductTableColumnMapping = z.infer<typeof productTableColumnMappingSchema>;
export type ProductTableConfig = z.infer<typeof productTableConfigSchema>;

export const templateDataSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  pageSize: z.enum(["A4", "Letter", "Legal"]).default("A4"),
  brand: templateBrandSchema,
  layoutModel: z.enum(["primitive_v1", "hybrid_v2"]).optional(),
  blocksV2: z.array(invoiceBlockSchema).optional(),
  pageSettings: templatePageSettingsSchema.optional(),
  theme: templateThemeSchema.optional(),
  repeating: templateRepeatingSchema.optional(),
  referenceLayer: templateReferenceLayerSchema.optional(),
  elements: z.array(templateElementSchema).default([]),
  backgroundElements: z.array(templateElementSchema).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  // Compliance metadata for invoice templates
  compliance: templateComplianceMetadataSchema.optional(),
  // Product table configuration for pre-mapping products to invoice tables
  productTableConfig: productTableConfigSchema.optional(),
  // Marketplace template ID if this template was imported from marketplace
  marketplaceTemplateId: z.string().optional(),
  // Block/schema version used when generating (for compatibility and marketplace)
  schemaVersion: z.number().int().min(1).optional(),
});

export type TemplateData = z.infer<typeof templateDataSchema>;

export const templateSchema = baseEntitySchema.merge(templateDataSchema);
export type Template = z.infer<typeof templateSchema>;

export const templateVersionDataSchema = z.object({
  templateId: z.string().min(1),
  version: z.number().int().min(1),
  data: templateDataSchema,
  publishedAt: z.string().min(1),
  createdBy: z.string().optional(), // User ID who created this version
  description: z.string().optional(), // Optional description of changes
});

export type TemplateVersionData = z.infer<typeof templateVersionDataSchema>;
export const templateVersionSchema = baseEntitySchema.merge(templateVersionDataSchema);
export type TemplateVersion = z.infer<typeof templateVersionSchema>;
