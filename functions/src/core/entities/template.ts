import z from "zod";
import { baseEntitySchema } from "./base";

export const templateElementBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "image", "table", "box", "line", "input", "currency"]),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  rotation: z.number().default(0),
  zIndex: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
});

export const textElementSchema = templateElementBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().default(""),
  binding: z.string().optional(),
  calc: z.string().optional(),
  typography: z.object({
    fontFamily: z.string().default("Inter"),
    fontSize: z.number().min(6).max(96).default(12),
    fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).default("normal"),
    lineHeight: z.number().min(0.8).max(2).default(1.2),
    letterSpacing: z.number().min(-2).max(10).default(0),
    color: z.string().default("#111827"),
    align: z.enum(["left", "center", "right"]).default("left"),
    uppercase: z.boolean().default(false),
    lowercase: z.boolean().default(false),
  }),
  // Enhanced styling options
  backgroundColor: z.string().optional(), // Background color for text element
  padding: z.number().min(0).max(50).default(0), // Padding around text
  opacity: z.number().min(0).max(1).default(1), // Opacity (0-1)
  shadow: z.object({
    enabled: z.boolean().default(false),
    blur: z.number().min(0).max(20).default(4),
    offsetX: z.number().min(-10).max(10).default(0),
    offsetY: z.number().min(-10).max(10).default(2),
    color: z.string().default("#00000040"),
  }).optional(),
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
  src: z.string().min(1),
  objectFit: z.enum(["contain", "cover", "fill", "none"]).default("contain"),
  alt: z.string().optional(),
});

export const boxElementSchema = templateElementBaseSchema.extend({
  type: z.literal("box"),
  fill: z.string().default("#ffffff00"),
  // Gradient support (if fillGradient is set, it overrides fill)
  fillGradient: z.object({
    type: z.enum(["linear", "radial"]).default("linear"),
    colors: z.array(z.string()).min(2).max(4), // Array of color stops
    angle: z.number().min(0).max(360).default(90), // For linear gradients
  }).optional(),
  stroke: z.string().default("#e5e7eb"),
  strokeWidth: z.number().min(0).max(10).default(1),
  radius: z.number().min(0).max(32).default(0),
  opacity: z.number().min(0).max(1).default(1), // Opacity (0-1)
  shadow: z.object({
    enabled: z.boolean().default(false),
    blur: z.number().min(0).max(20).default(4),
    offsetX: z.number().min(-10).max(10).default(0),
    offsetY: z.number().min(-10).max(10).default(2),
    color: z.string().default("#00000040"),
  }).optional(),
});

export const lineElementSchema = templateElementBaseSchema.extend({
  type: z.literal("line"),
  x2: z.number().min(0),
  y2: z.number().min(0),
  stroke: z.string().default("#e5e7eb"),
  strokeWidth: z.number().min(0.5).max(10).default(1),
});

export const inputElementSchema = templateElementBaseSchema.extend({
  type: z.literal("input"),
  placeholder: z.string().default(""),
  binding: z.string().optional(),
  variant: z.enum(["text", "number", "date"]).default("text"),
  align: z.enum(["left", "center", "right"]).default("left"),
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
  align: z.enum(["left", "center", "right"]).default("left"),
});

export const tableColumnSchema = z.object({
  id: z.string().min(1),
  header: z.string().default("Column"),
  width: z.number().min(20).default(80),
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
  totals: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        calc: z.string().min(1),
        align: z.enum(["left", "center", "right"]).default("right"),
      }),
    )
    .default([]),
});

export const templateElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  tableElementSchema,
  boxElementSchema,
  lineElementSchema,
  inputElementSchema,
  currencyElementSchema,
]);

export type TemplateElement = z.infer<typeof templateElementSchema>;

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
    .default({ top: 40, right: 40, bottom: 40, left: 40 }),
  backgroundImage: z.string().optional(),
});

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

export const templateDataSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  pageSize: z.enum(["A4", "Letter"]).default("A4"),
  brand: templateBrandSchema,
  elements: z.array(templateElementSchema).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  // Compliance metadata for invoice templates
  compliance: templateComplianceMetadataSchema.optional(),
});

export type TemplateData = z.infer<typeof templateDataSchema>;

export const templateSchema = baseEntitySchema.merge(templateDataSchema);
export type Template = z.infer<typeof templateSchema>;

export const templateVersionDataSchema = z.object({
  templateId: z.string().min(1),
  version: z.number().int().min(1),
  data: templateDataSchema,
  publishedAt: z.string().min(1),
});

export type TemplateVersionData = z.infer<typeof templateVersionDataSchema>;
export const templateVersionSchema = baseEntitySchema.merge(templateVersionDataSchema);
export type TemplateVersion = z.infer<typeof templateVersionSchema>;


