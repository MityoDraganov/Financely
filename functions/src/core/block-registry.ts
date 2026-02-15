/**
 * Block registry: single source of truth for template element types and their
 * LLM-facing props. Used to build the Gemini JSON Schema so the model selects
 * from allowed blocks only.
 */

export const BLOCK_SCHEMA_VERSION = 2;

/** Allowed template element types. */
export const TEMPLATE_ELEMENT_TYPES = [
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
] as const;

export type TemplateElementType = (typeof TEMPLATE_ELEMENT_TYPES)[number];

type SchemaFragment = Record<string, unknown>;

const spacingSchema: SchemaFragment = {
  type: "object",
  properties: {
    top: { type: "number" },
    right: { type: "number" },
    bottom: { type: "number" },
    left: { type: "number" },
  },
};

const borderSchema: SchemaFragment = {
  type: "object",
  properties: {
    width: { type: "number" },
    color: { type: "string" },
    style: {
      type: "string",
      enum: ["solid", "dashed", "dotted", "double", "groove", "ridge"],
    },
    radius: { type: "number" },
  },
};

const shadowSchema: SchemaFragment = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    blur: { type: "number" },
    offsetX: { type: "number" },
    offsetY: { type: "number" },
    spread: { type: "number" },
    color: { type: "string" },
  },
};

const typographySchema: SchemaFragment = {
  type: "object",
  properties: {
    fontFamily: { type: "string" },
    fontSize: { type: "number" },
    fontWeight: { type: "string", enum: ["normal", "medium", "semibold", "bold"] },
    fontStyle: { type: "string", enum: ["normal", "italic"] },
    lineHeight: { type: "number" },
    letterSpacing: { type: "number" },
    wordSpacing: { type: "number" },
    color: { type: "string" },
    align: { type: "string", enum: ["left", "center", "right", "justify"] },
    uppercase: { type: "boolean" },
    lowercase: { type: "boolean" },
    textDecoration: { type: "string", enum: ["none", "underline", "line-through"] },
    textIndent: { type: "number" },
  },
};

const formatSchema: SchemaFragment = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["none", "currency", "date"] },
    currency: { type: "string" },
    dateFormat: { type: "string" },
  },
};

const baseElementRequired = ["id", "type", "x", "y", "width", "height"];

const baseElementProps: Record<string, SchemaFragment> = {
  id: { type: "string" },
  type: { type: "string", enum: [...TEMPLATE_ELEMENT_TYPES] },
  x: { type: "number" },
  y: { type: "number" },
  width: { type: "number" },
  height: { type: "number" },
  rotation: { type: "number" },
  zIndex: { type: "number" },
  visible: { type: "boolean" },
  locked: { type: "boolean" },
  groupId: { type: "string" },
};

const tableColumnSchema: SchemaFragment = {
  type: "object",
  required: ["id", "header", "width", "type"],
  properties: {
    id: { type: "string" },
    header: { type: "string" },
    width: { type: "number" },
    align: { type: "string", enum: ["left", "center", "right"] },
    type: { type: "string", enum: ["text", "number", "date", "currency"] },
    binding: { type: "string" },
    calc: { type: "string" },
    format: formatSchema,
    currency: { type: "string" },
    mode: { type: "string", enum: ["independent", "linked", "formula"] },
    showTotal: { type: "boolean" },
    totalStyle: {
      type: "object",
      properties: {
        backgroundColor: { type: "string" },
        fontWeight: { type: "string", enum: ["normal", "bold", "600", "700"] },
        fontSize: { type: "number" },
        color: { type: "string" },
        borderTop: { type: "string" },
      },
    },
  },
};

function withBaseProps(
  type: TemplateElementType,
  specificProps: Record<string, SchemaFragment>,
  requiredProps: string[] = []
): SchemaFragment {
  return {
    type: "object",
    required: [...baseElementRequired, ...requiredProps],
    properties: {
      ...baseElementProps,
      type: { type: "string", enum: [type] },
      ...specificProps,
    },
    additionalProperties: false,
  };
}

function buildElementVariantSchemas(): SchemaFragment[] {
  return [
    withBaseProps("text", {
      text: { type: "string" },
      binding: { type: "string" },
      calc: { type: "string" },
      typography: typographySchema,
      format: formatSchema,
      backgroundColor: { type: "string" },
      padding: { type: "number" },
      opacity: { type: "number" },
      shadow: shadowSchema,
    }, ["text"]),
    withBaseProps("image", {
      src: { type: "string" },
      binding: { type: "string" },
      objectFit: { type: "string", enum: ["contain", "cover", "fill", "none", "scale-down"] },
      objectPosition: { type: "string" },
      opacity: { type: "number" },
      border: borderSchema,
      shadow: shadowSchema,
      filter: {
        type: "object",
        properties: {
          blur: { type: "number" },
          brightness: { type: "number" },
          contrast: { type: "number" },
          grayscale: { type: "number" },
        },
      },
      overlay: {
        type: "object",
        properties: {
          color: { type: "string" },
          opacity: { type: "number" },
        },
      },
      padding: spacingSchema,
      margin: spacingSchema,
      shape: { type: "string", enum: ["rectangle", "circle", "custom"] },
      clipPath: { type: "string" },
      link: { type: "string" },
      alt: { type: "string" },
    }, ["src"]),
    withBaseProps("table", {
      rowHeight: { type: "number" },
      headerHeight: { type: "number" },
      stripe: { type: "boolean" },
      columns: { type: "array", items: tableColumnSchema },
      itemsBinding: { type: "string" },
      designRows: { type: "array", items: { type: "object" } },
      headerStyle: typographySchema,
      rowStyle: typographySchema,
      footerStyle: typographySchema,
      headerBackground: { type: "string" },
      rowBackground: { type: "string" },
      alternateRowBackground: { type: "string" },
      footerBackground: { type: "string" },
      borderStyle: { type: "string", enum: ["none", "rows", "columns", "all", "outer"] },
      borderColor: { type: "string" },
      borderWidth: { type: "number" },
      cellPadding: spacingSchema,
      shadow: shadowSchema,
      showFooter: { type: "boolean" },
    }, ["itemsBinding", "columns"]),
    withBaseProps("box", {
      fill: { type: "string" },
      shape: { type: "string", enum: ["rectangle", "circle", "triangle", "polygon", "custom"] },
      points: { type: "number" },
      clipPath: { type: "string" },
      fillGradient: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["linear", "radial"] },
          colors: { type: "array", items: { type: "string" } },
          angle: { type: "number" },
        },
      },
      stroke: { type: "string" },
      strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
      strokeWidth: { type: "number" },
      radius: { type: "number" },
      opacity: { type: "number" },
      shadow: shadowSchema,
    }),
    withBaseProps("line", {
      x2: { type: "number" },
      y2: { type: "number" },
      stroke: { type: "string" },
      strokeWidth: { type: "number" },
      style: { type: "string", enum: ["solid", "dashed", "dotted", "double", "groove", "ridge"] },
      pattern: { type: "string", enum: ["line", "wave", "zigzag", "dots", "custom"] },
      align: { type: "string", enum: ["left", "center", "right"] },
      opacity: { type: "number" },
      gradient: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
          angle: { type: "number" },
        },
      },
      shadow: shadowSchema,
    }, ["x2", "y2"]),
    withBaseProps("input", {
      placeholder: { type: "string" },
      binding: { type: "string" },
      variant: { type: "string", enum: ["text", "number", "date"] },
      align: { type: "string", enum: ["left", "center", "right"] },
    }),
    withBaseProps("currency", {
      placeholder: { type: "string" },
      binding: { type: "string" },
      currency: { type: "string" },
      currencyLinks: { type: "array", items: { type: "object" } },
      mode: { type: "string", enum: ["independent", "linked", "formula"] },
      formula: { type: "string" },
      align: { type: "string", enum: ["left", "center", "right"] },
    }),
    withBaseProps("icon", {
      iconName: { type: "string" },
      library: { type: "string", enum: ["lucide", "fontawesome", "material", "custom"] },
      customIconUrl: { type: "string" },
      color: { type: "string" },
      backgroundColor: { type: "string" },
      padding: { type: "number" },
      border: borderSchema,
      shape: { type: "string", enum: ["none", "circle", "square", "rounded"] },
      flip: { type: "string", enum: ["none", "horizontal", "vertical", "both"] },
      effect: { type: "string", enum: ["none", "shadow", "glow", "outline"] },
      link: { type: "string" },
      tooltip: { type: "string" },
    }, ["iconName"]),
    withBaseProps("spacer", {
      showDivider: { type: "boolean" },
      dividerStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
      dividerColor: { type: "string" },
      dividerWidth: { type: "number" },
    }),
    withBaseProps("pageBreak", {
      breakType: { type: "string", enum: ["always", "avoid", "auto"] },
      showInEditor: { type: "boolean" },
      style: { type: "string", enum: ["line", "dashed", "none"] },
    }),
    withBaseProps("qrCode", {
      content: { type: "string" },
      binding: { type: "string" },
      dataType: { type: "string", enum: ["url", "text", "payment", "custom"] },
      foregroundColor: { type: "string" },
      backgroundColor: { type: "string" },
      errorCorrection: { type: "string", enum: ["low", "medium", "high", "ultra"] },
      margin: { type: "number" },
      border: borderSchema,
      logo: { type: "object", properties: { show: { type: "boolean" }, image: { type: "string" }, size: { type: "number" } } },
    }),
    withBaseProps("barcode", {
      value: { type: "string" },
      binding: { type: "string" },
      format: { type: "string", enum: ["CODE128", "CODE39", "EAN13", "UPC"] },
      color: { type: "string" },
      backgroundColor: { type: "string" },
      showText: { type: "boolean" },
      textPosition: { type: "string", enum: ["top", "bottom"] },
    }),
    withBaseProps("signature", {
      signatureType: { type: "string", enum: ["placeholder", "image", "drawn"] },
      signatureImage: { type: "string" },
      signatureName: { type: "string" },
      signatureTitle: { type: "string" },
      showDate: { type: "boolean" },
      borderBottom: {
        type: "object",
        properties: {
          width: { type: "number" },
          color: { type: "string" },
          style: { type: "string", enum: ["solid", "dashed", "dotted"] },
        },
      },
      placeholderText: { type: "string" },
    }),
    withBaseProps("stamp", {
      text: { type: "string" },
      stampType: { type: "string", enum: ["paid", "overdue", "draft", "void", "custom"] },
      shape: { type: "string", enum: ["rectangle", "circle", "badge", "custom"] },
      size: { type: "number" },
      fontFamily: { type: "string" },
      fontSize: { type: "number" },
      fontWeight: { type: "string", enum: ["normal", "medium", "semibold", "bold"] },
      textColor: { type: "string" },
      backgroundColor: { type: "string" },
      border: borderSchema,
      opacity: { type: "number" },
      effect: { type: "string", enum: ["stamped", "embossed", "flat"] },
      pattern: { type: "string", enum: ["diagonal-lines", "dots", "none"] },
    }),
  ];
}

/**
 * Human-readable capability summary injected in prompts so the model knows
 * which style controls and advanced element types are available.
 */
export function buildTemplateSchemaGuidance(): string {
  return [
    "Supported primitive element types:",
    "- text, image, table, box, line, input, currency, icon, spacer, pageBreak, qrCode, barcode, signature, stamp",
    "Key visual property groups:",
    "- text: typography(font family/size/weight/style, lineHeight, letterSpacing, wordSpacing, align, case), format, shadow, opacity, backgroundColor, padding",
    "- image: objectFit/objectPosition, border, radius, shadow, filter, overlay, opacity, shape/clipPath",
    "- table: columns(type/binding/format/calc), header/row/footer typography, backgrounds, border modes, cellPadding, showFooter",
    "- box/line/icon: gradients, patterns, stroke styles, effects, flip/shape/padding/background",
    "- qrCode/barcode/signature/stamp: full dedicated settings are supported",
    "Template-level optional systems:",
    "- layoutModel, pageSettings, theme, repeating header/footer, referenceLayer, blocksV2",
    "For extraction outputs:",
    "- Prefer primitives in elements[] for runtime compatibility.",
  ].join("\n");
}

/**
 * Builds the Gemini-facing JSON Schema for a full template.
 * Used by both TemplateFromExtractionService and InvoiceTemplateGenerationService.
 */
export function buildTemplateGenerationSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["name", "pageSize", "brand", "elements"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      pageSize: { type: "string", enum: ["A4", "Letter", "Legal"] },
      status: { type: "string", enum: ["draft", "published"] },
      layoutModel: { type: "string", enum: ["primitive_v1", "hybrid_v2"] },
      brand: {
        type: "object",
        required: ["fonts", "colors", "margins"],
        properties: {
          fonts: { type: "array", items: { type: "string" } },
          colors: {
            type: "object",
            required: ["primary", "secondary", "accent"],
            properties: {
              primary: { type: "string" },
              secondary: { type: "string" },
              accent: { type: "string" },
            },
          },
          margins: {
            type: "object",
            required: ["top", "right", "bottom", "left"],
            properties: {
              top: { type: "number" },
              right: { type: "number" },
              bottom: { type: "number" },
              left: { type: "number" },
            },
          },
          backgroundImage: { type: "string" },
          watermark: { type: "object" },
        },
      },
      pageSettings: {
        type: "object",
        properties: {
          size: { type: "string", enum: ["A4", "Letter", "Legal", "Custom"] },
          orientation: { type: "string", enum: ["portrait", "landscape"] },
          customSize: {
            type: "object",
            properties: { width: { type: "number" }, height: { type: "number" } },
          },
          margins: spacingSchema,
          padding: spacingSchema,
          backgroundColor: { type: "string" },
          backgroundImage: { type: "string" },
          backgroundOpacity: { type: "number" },
        },
      },
      theme: {
        type: "object",
        properties: {
          colors: { type: "object" },
          fonts: { type: "object" },
          radii: { type: "object" },
          shadows: { type: "object" },
        },
      },
      repeating: {
        type: "object",
        properties: {
          header: { type: "object" },
          footer: { type: "object" },
        },
      },
      referenceLayer: {
        type: "object",
        properties: {
          assetUrl: { type: "string" },
          opacity: { type: "number" },
          visible: { type: "boolean" },
          locked: { type: "boolean" },
          offsetX: { type: "number" },
          offsetY: { type: "number" },
          scale: { type: "number" },
          rotation: { type: "number" },
        },
      },
      blocksV2: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type"],
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: [
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
              ],
            },
            props: { type: "object" },
            children: { type: "array", items: { type: "object" } },
            columns: { type: "array", items: { type: "object" } },
          },
        },
      },
      elements: {
        type: "array",
        minItems: 1,
        maxItems: 280,
        items: {
          oneOf: buildElementVariantSchemas(),
        },
      },
      schemaVersion: { type: "number" },
    },
  };
}
