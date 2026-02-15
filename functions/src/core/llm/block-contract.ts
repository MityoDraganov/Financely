/**
 * Single source of truth for LLM-facing template block capabilities.
 *
 * Keep block type metadata, prompt guidance, and schema-mapped properties here.
 * Other modules should build schemas/guidance/manifests from this contract
 * instead of redefining block capabilities in multiple places.
 */

export const BLOCK_SCHEMA_VERSION = 3;

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
export type TemplateLlmTask = "template_generation" | "invoice_vision_clone";

/**
 * Curated Lucide icon names for invoice-focused UI cloning.
 * Keep this list in sync with designer expectations.
 */
export const INVOICE_VISION_ICON_CATALOG = [
  "file-text",
  "receipt",
  "building-2",
  "user",
  "users",
  "mail",
  "phone",
  "map-pin",
  "globe",
  "calendar",
  "clock-3",
  "hash",
  "landmark",
  "wallet",
  "banknote",
  "badge-dollar-sign",
  "circle-dollar-sign",
  "credit-card",
  "percent",
  "truck",
  "package",
  "shield-check",
  "check-circle-2",
  "alert-triangle",
  "info",
  "signature",
  "qr-code",
  "barcode",
  "image",
  "stamp",
] as const;

type SchemaFragment = Record<string, unknown>;

type BlockLlmContract = {
  purpose: string;
  requiredProps: string[];
  styleProps: string[];
  bindingProps: string[];
  defaults?: Record<string, unknown>;
  constraints?: string[];
  example?: Record<string, unknown>;
  tasks?: TemplateLlmTask[];
};

type BlockSchemaContract = {
  requiredProps?: string[];
  properties: Record<string, SchemaFragment>;
};

type BlockContract = {
  schema: BlockSchemaContract;
  llm: BlockLlmContract;
};

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

const tableTextBehaviorSchema: SchemaFragment = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["wrap", "nowrap", "break-words", "ellipsis", "clamp"] },
    clampLines: { type: "number" },
  },
};

const tableTypographySchema: SchemaFragment = {
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
    textBehavior: tableTextBehaviorSchema,
  },
};

const tableColumnSchema: SchemaFragment = {
  type: "object",
  required: ["id", "header", "width", "type"],
  properties: {
    id: { type: "string" },
    header: { type: "string" },
    width: { anyOf: [{ type: "string" }, { type: "number" }] },
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

const TEMPLATE_BLOCK_CONTRACT: Record<TemplateElementType, BlockContract> = {
  text: {
    schema: {
      requiredProps: ["text"],
      properties: {
        text: { type: "string" },
        binding: { type: "string" },
        calc: { type: "string" },
        typography: typographySchema,
        format: formatSchema,
        backgroundColor: { type: "string" },
        padding: { type: "number" },
        opacity: { type: "number" },
        shadow: shadowSchema,
      },
    },
    llm: {
      purpose: "Static labels and lightweight dynamic textual fields.",
      requiredProps: ["text"],
      styleProps: [
        "typography.fontFamily",
        "typography.fontSize",
        "typography.fontWeight",
        "typography.align",
        "typography.color",
        "opacity",
        "backgroundColor",
        "padding",
      ],
      bindingProps: ["binding", "calc", "format.kind", "format.currency", "format.dateFormat"],
      defaults: { "typography.align": "left", "typography.fontSize": 12 },
      constraints: [
        "Use text without binding for static labels.",
        "Use binding when text is dynamic.",
      ],
      example: {
        type: "text",
        text: "Invoice #",
        x: 40,
        y: 80,
        width: 120,
        height: 24,
      },
    },
  },
  image: {
    schema: {
      requiredProps: [],
      properties: {
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
      },
    },
    llm: {
      purpose: "Logos and decorative/media visual assets.",
      requiredProps: [],
      styleProps: [
        "objectFit",
        "objectPosition",
        "border",
        "shadow",
        "filter",
        "overlay",
        "opacity",
      ],
      bindingProps: ["binding"],
      defaults: { objectFit: "contain" },
      constraints: [
        "Prefer image block for logos instead of approximating with text.",
        "If source cannot be resolved, keep src empty to create a placeholder image block.",
      ],
    },
  },
  table: {
    schema: {
      requiredProps: ["itemsBinding", "columns"],
      properties: {
        rowHeight: { type: "number" },
        headerHeight: { type: "number" },
        stripe: { type: "boolean" },
        columns: { type: "array", items: tableColumnSchema },
        itemsBinding: { type: "string" },
        designRows: { type: "array", items: { type: "object" } },
        headerStyle: tableTypographySchema,
        rowStyle: tableTypographySchema,
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
      },
    },
    llm: {
      purpose: "Line items and repeating tabular invoice data.",
      requiredProps: ["itemsBinding", "columns"],
      styleProps: [
        "headerStyle",
        "headerStyle.textBehavior",
        "rowStyle",
        "rowStyle.textBehavior",
        "footerStyle",
        "headerBackground",
        "rowBackground",
        "alternateRowBackground",
        "borderStyle",
        "borderColor",
        "borderWidth",
        "stripe",
      ],
      bindingProps: ["itemsBinding", "columns[].binding", "columns[].calc", "columns[].format"],
      defaults: { itemsBinding: "items", borderStyle: "rows" },
      constraints: [
        "Use one table for repeating item collections.",
        "Do not invent columns that are not present in source context.",
      ],
    },
  },
  box: {
    schema: {
      properties: {
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
      },
    },
    llm: {
      purpose: "Containers, highlights, and background shapes.",
      requiredProps: [],
      styleProps: [
        "fill",
        "fillGradient",
        "stroke",
        "strokeStyle",
        "strokeWidth",
        "radius",
        "shadow",
        "opacity",
      ],
      bindingProps: [],
    },
  },
  line: {
    schema: {
      requiredProps: ["x2", "y2"],
      properties: {
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
      },
    },
    llm: {
      purpose: "Dividers and visual separators.",
      requiredProps: ["x2", "y2"],
      styleProps: ["stroke", "strokeWidth", "style", "pattern", "opacity"],
      bindingProps: [],
    },
  },
  input: {
    schema: {
      properties: {
        placeholder: { type: "string" },
        binding: { type: "string" },
        variant: { type: "string", enum: ["text", "number", "date"] },
        align: { type: "string", enum: ["left", "center", "right"] },
        fontFamily: { type: "string" },
      },
    },
    llm: {
      purpose: "Dynamic non-monetary scalar values from invoice data.",
      requiredProps: [],
      styleProps: ["align", "fontFamily"],
      bindingProps: ["binding", "variant"],
      constraints: ["Prefer input for dynamic text/date/number values."],
    },
  },
  currency: {
    schema: {
      properties: {
        placeholder: { type: "string" },
        binding: { type: "string" },
        currency: { type: "string" },
        currencyLinks: { type: "array", items: { type: "object" } },
        mode: { type: "string", enum: ["independent", "linked", "formula"] },
        formula: { type: "string" },
        align: { type: "string", enum: ["left", "center", "right"] },
        fontFamily: { type: "string" },
      },
    },
    llm: {
      purpose: "Dynamic monetary fields and formula totals.",
      requiredProps: [],
      styleProps: ["align", "fontFamily"],
      bindingProps: ["binding", "currency", "mode", "formula"],
      constraints: ["Use currency for monetary values instead of input/text."],
    },
  },
  icon: {
    schema: {
      requiredProps: ["iconName"],
      properties: {
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
      },
    },
    llm: {
      purpose: "Visual accents and status glyphs.",
      requiredProps: ["iconName"],
      styleProps: ["color", "backgroundColor", "border", "shape", "flip", "effect"],
      bindingProps: [],
      constraints: ["For invoice_vision_clone, choose iconName from iconCatalog."],
    },
  },
  spacer: {
    schema: {
      properties: {
        showDivider: { type: "boolean" },
        dividerStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
        dividerColor: { type: "string" },
        dividerWidth: { type: "number" },
      },
    },
    llm: {
      purpose: "Vertical rhythm and separation between sections.",
      requiredProps: [],
      styleProps: ["showDivider", "dividerStyle", "dividerColor", "dividerWidth"],
      bindingProps: [],
    },
  },
  pageBreak: {
    schema: {
      properties: {
        breakType: { type: "string", enum: ["always", "avoid", "auto"] },
        showInEditor: { type: "boolean" },
        style: { type: "string", enum: ["line", "dashed", "none"] },
      },
    },
    llm: {
      purpose: "Explicit pagination for long documents.",
      requiredProps: [],
      styleProps: ["breakType", "style"],
      bindingProps: [],
    },
  },
  qrCode: {
    schema: {
      properties: {
        content: { type: "string" },
        binding: { type: "string" },
        dataType: { type: "string", enum: ["url", "text", "payment", "custom"] },
        foregroundColor: { type: "string" },
        backgroundColor: { type: "string" },
        errorCorrection: { type: "string", enum: ["low", "medium", "high", "ultra"] },
        margin: { type: "number" },
        border: borderSchema,
        logo: {
          type: "object",
          properties: {
            show: { type: "boolean" },
            image: { type: "string" },
            size: { type: "number" },
          },
        },
      },
    },
    llm: {
      purpose: "Payment or metadata QR codes.",
      requiredProps: [],
      styleProps: ["foregroundColor", "backgroundColor", "errorCorrection", "margin", "border"],
      bindingProps: ["content", "binding", "dataType"],
    },
  },
  barcode: {
    schema: {
      properties: {
        value: { type: "string" },
        binding: { type: "string" },
        format: { type: "string", enum: ["CODE128", "CODE39", "EAN13", "UPC"] },
        color: { type: "string" },
        backgroundColor: { type: "string" },
        showText: { type: "boolean" },
        textPosition: { type: "string", enum: ["top", "bottom"] },
      },
    },
    llm: {
      purpose: "Machine-readable identifiers.",
      requiredProps: [],
      styleProps: ["format", "color", "backgroundColor", "showText", "textPosition"],
      bindingProps: ["value", "binding"],
    },
  },
  signature: {
    schema: {
      properties: {
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
      },
    },
    llm: {
      purpose: "Signature placeholders and signed marks.",
      requiredProps: [],
      styleProps: ["signatureType", "borderBottom", "showDate"],
      bindingProps: [],
    },
  },
  stamp: {
    schema: {
      properties: {
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
      },
    },
    llm: {
      purpose: "Status stamps such as PAID, DRAFT, OVERDUE.",
      requiredProps: [],
      styleProps: [
        "text",
        "stampType",
        "shape",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "textColor",
        "backgroundColor",
        "border",
        "opacity",
        "effect",
        "pattern",
      ],
      bindingProps: [],
    },
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

function shouldIncludeBlockInTask(blockType: TemplateElementType, task: TemplateLlmTask): boolean {
  const tasks = TEMPLATE_BLOCK_CONTRACT[blockType].llm.tasks;
  return !tasks || tasks.includes(task);
}

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

function buildElementVariantSchemas(task: TemplateLlmTask = "template_generation"): SchemaFragment[] {
  return TEMPLATE_ELEMENT_TYPES
    .filter((blockType) => shouldIncludeBlockInTask(blockType, task))
    .map((blockType) =>
      withBaseProps(
        blockType,
        TEMPLATE_BLOCK_CONTRACT[blockType].schema.properties,
        TEMPLATE_BLOCK_CONTRACT[blockType].schema.requiredProps || []
      )
    );
}

export function buildTemplateLlmManifest(task: TemplateLlmTask = "template_generation"): {
  contractVersion: number;
  task: TemplateLlmTask;
  allowedBlocks: TemplateElementType[];
  iconCatalog?: readonly string[];
  blocks: Record<
    string,
    {
      purpose: string;
      requiredProps: string[];
      styleProps: string[];
      bindingProps: string[];
      defaults?: Record<string, unknown>;
      constraints?: string[];
      example?: Record<string, unknown>;
    }
  >;
  globalRules: string[];
  propertyAliases: Record<string, string>;
} {
  const allowedBlocks = TEMPLATE_ELEMENT_TYPES.filter((blockType) =>
    shouldIncludeBlockInTask(blockType, task)
  );

  const blocks = Object.fromEntries(
    allowedBlocks.map((blockType) => {
      const llm = TEMPLATE_BLOCK_CONTRACT[blockType].llm;
      return [
        blockType,
        {
          purpose: llm.purpose,
          requiredProps: llm.requiredProps,
          styleProps: llm.styleProps,
          bindingProps: llm.bindingProps,
          ...(llm.defaults ? { defaults: llm.defaults } : {}),
          ...(llm.constraints ? { constraints: llm.constraints } : {}),
          ...(llm.example ? { example: llm.example } : {}),
        },
      ];
    })
  );

  return {
    contractVersion: BLOCK_SCHEMA_VERSION,
    task,
    allowedBlocks,
    ...(task === "invoice_vision_clone" ? { iconCatalog: INVOICE_VISION_ICON_CATALOG } : {}),
    blocks,
    globalRules: [
      "Use only blocks listed in allowedBlocks.",
      "Use only properties listed in the block contract.",
      "Respect requiredProps for each block.",
      "Keep all elements within canvas bounds.",
      "Use table block for repeating line-item arrays.",
      "Use currency or currency table columns for monetary values.",
    ],
    propertyAliases: {
      alignment: "typography.align",
      fontSize: "typography.fontSize",
      hexColor: "typography.color",
    },
  };
}

/**
 * Human-readable guidance string derived from the block contract.
 * Safe to inject into prompts where JSON verbosity is undesirable.
 */
export function buildTemplateSchemaGuidance(task: TemplateLlmTask = "template_generation"): string {
  const manifest = buildTemplateLlmManifest(task);
  const lines: string[] = [];
  lines.push(`Block contract version: ${manifest.contractVersion}`);
  lines.push(`Allowed blocks (${manifest.allowedBlocks.length}): ${manifest.allowedBlocks.join(", ")}`);

  for (const blockType of manifest.allowedBlocks) {
    const block = manifest.blocks[blockType];
    lines.push(
      `- ${blockType}: purpose=${block.purpose}; required=[${block.requiredProps.join(", ")}]; style=[${block.styleProps.join(", ")}]; binding=[${block.bindingProps.join(", ")}]`
    );
  }

  lines.push("Global rules:");
  for (const rule of manifest.globalRules) {
    lines.push(`- ${rule}`);
  }

  return lines.join("\n");
}

/**
 * Builds the Gemini-facing JSON schema for full template generation.
 * Backward-compatible signature; task adapter optionally restricts block set.
 */
export function buildTemplateGenerationSchema(
  task: TemplateLlmTask = "template_generation"
): Record<string, unknown> {
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
          marginUnit: { type: "string", enum: ["in", "cm"] },
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
          oneOf: buildElementVariantSchemas(task),
        },
      },
      schemaVersion: { type: "number" },
    },
  };
}
