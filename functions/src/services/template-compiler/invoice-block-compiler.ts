import type { InvoiceBlock, TemplateData, TemplateElement } from "../../core/entities/template";

type CompileInput = {
  blocks: InvoiceBlock[];
  template: Pick<TemplateData, "pageSettings" | "theme" | "repeating">;
};

type TableColumn = Extract<TemplateElement, { type: "table" }>["columns"][number];

function toNum(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function ensureBounds(partial: Partial<TemplateElement>): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
} {
  return {
    x: toNum(partial.x, 0),
    y: toNum(partial.y, 0),
    width: Math.max(1, toNum(partial.width, 120)),
    height: Math.max(1, toNum(partial.height, 32)),
    rotation: toNum(partial.rotation, 0),
    zIndex: Math.max(0, Math.floor(toNum(partial.zIndex, 0))),
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
  };
}

function defaultTableColumns(blockId: string): TableColumn[] {
  return [
    {
      id: `${blockId}-c1`,
      header: "Description",
      width: "44%",
      align: "left",
      type: "text",
      format: { kind: "none" },
      showTotal: false,
    },
    {
      id: `${blockId}-c2`,
      header: "Qty",
      width: "16%",
      align: "right",
      type: "number",
      format: { kind: "none" },
      showTotal: false,
    },
    {
      id: `${blockId}-c3`,
      header: "Price",
      width: "20%",
      align: "right",
      type: "currency",
      format: { kind: "currency", currency: "USD" },
      currency: "USD",
      showTotal: false,
    },
    {
      id: `${blockId}-c4`,
      header: "Total",
      width: "20%",
      align: "right",
      type: "currency",
      format: { kind: "currency", currency: "USD" },
      currency: "USD",
      showTotal: true,
    },
  ];
}

function compileBlock(block: InvoiceBlock, out: TemplateElement[], inheritedZ = 0): void {
  const props = block.props ?? {};
  const x = toNum(props.x, 40);
  const y = toNum(props.y, 40);
  const width = toNum(props.width, 240);
  const height = toNum(props.height, 80);
  const rotation = toNum(props.rotation, 0);
  const zIndex = toNum(props.zIndex, inheritedZ);
  const visible = props.visible === undefined ? true : toBool(props.visible, true);

  const base = ensureBounds({ x, y, width, height, rotation, zIndex, visible });

  switch (block.type) {
    case "text": {
      out.push({
        id: `${block.id}-text`,
        type: "text",
        ...base,
        text: toStr(props.content, "Text"),
        binding: typeof props.binding === "string" ? props.binding : undefined,
        typography: {
          fontFamily: toStr(props.fontFamily, "Inter"),
          fontSize: toNum(props.fontSize, 12),
          fontWeight: (props.fontWeight as "normal" | "medium" | "semibold" | "bold") || "normal",
          fontStyle: (props.fontStyle as "normal" | "italic") || "normal",
          lineHeight: toNum(props.lineHeight, 1.2),
          letterSpacing: toNum(props.letterSpacing, 0),
          wordSpacing: toNum(props.wordSpacing, 0),
          color: toStr(props.color, "#111827"),
          align: (props.align as "left" | "center" | "right" | "justify") || "left",
          uppercase: toBool(props.uppercase),
          lowercase: toBool(props.lowercase),
          textDecoration: (props.textDecoration as "none" | "underline" | "line-through") || "none",
          textIndent: toNum(props.textIndent, 0),
        },
        backgroundColor: typeof props.backgroundColor === "string" ? props.backgroundColor : undefined,
        opacity: toNum(props.opacity, 1),
        format: { kind: "none" },
      });
      break;
    }
    case "image": {
      out.push({
        id: `${block.id}-image`,
        type: "image",
        ...base,
        src: toStr(props.src, ""),
        binding: typeof props.binding === "string" ? props.binding : undefined,
        objectFit: (props.objectFit as "contain" | "cover" | "fill" | "none" | "scale-down") || "contain",
        objectPosition: toStr(props.objectPosition, "center"),
        opacity: toNum(props.opacity, 1),
        alt: typeof props.alt === "string" ? props.alt : undefined,
      });
      break;
    }
    case "divider": {
      out.push({
        id: `${block.id}-line`,
        type: "line",
        ...base,
        x2: base.x + base.width,
        y2: base.y,
        stroke: toStr(props.color, "#d1d5db"),
        strokeWidth: toNum(props.thickness, 1),
        style: (props.style as "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge") || "solid",
        pattern: (props.pattern as "line" | "wave" | "zigzag" | "dots" | "custom") || "line",
        align: (props.align as "left" | "center" | "right") || "left",
        opacity: toNum(props.opacity, 1),
      });
      break;
    }
    case "shape": {
      out.push({
        id: `${block.id}-shape`,
        type: "box",
        ...base,
        shape: (props.shape as "rectangle" | "circle" | "triangle" | "polygon" | "custom") || "rectangle",
        points: typeof props.points === "number" ? props.points : undefined,
        clipPath: typeof props.clipPath === "string" ? props.clipPath : undefined,
        fill: toStr(props.fill, "#ffffff00"),
        stroke: toStr(props.stroke, "#d1d5db"),
        strokeStyle: (props.strokeStyle as "solid" | "dashed" | "dotted") || "solid",
        strokeWidth: toNum(props.strokeWidth, 1),
        radius: toNum(props.radius, 0),
        opacity: toNum(props.opacity, 1),
      });
      break;
    }
    case "icon": {
      out.push({
        id: `${block.id}-icon`,
        type: "icon",
        ...base,
        iconName: toStr(props.iconName, "file-text"),
        library: (props.library as "lucide" | "fontawesome" | "material" | "custom") || "lucide",
        color: toStr(props.color, "#111827"),
        backgroundColor: typeof props.backgroundColor === "string" ? props.backgroundColor : undefined,
        shape: (props.shape as "none" | "circle" | "square" | "rounded") || "none",
        flip: (props.flip as "none" | "horizontal" | "vertical" | "both") || "none",
        effect: (props.effect as "none" | "shadow" | "glow" | "outline") || "none",
      });
      break;
    }
    case "table":
    case "lineItems": {
      const columns = Array.isArray(props.columns)
        ? (props.columns as TableColumn[])
        : defaultTableColumns(block.id);
      const borderStyle =
        props.borderStyle === "none" ||
        props.borderStyle === "rows" ||
        props.borderStyle === "columns" ||
        props.borderStyle === "all" ||
        props.borderStyle === "outer"
          ? props.borderStyle
          : undefined;

      out.push({
        id: `${block.id}-table`,
        type: "table",
        ...base,
        rowHeight: toNum(props.rowHeight, 28),
        headerHeight: toNum(props.headerHeight, 28),
        stripe: toBool(props.stripe, true),
        itemsBinding: toStr(props.itemsBinding, block.type === "lineItems" ? "line_items" : "items"),
        columns,
        designRows: [],
        headerStyle:
          typeof props.headerStyle === "object" && props.headerStyle !== null
            ? (props.headerStyle as Record<string, unknown> as Extract<TemplateElement, { type: "table" }>["headerStyle"])
            : undefined,
        rowStyle:
          typeof props.rowStyle === "object" && props.rowStyle !== null
            ? (props.rowStyle as Record<string, unknown> as Extract<TemplateElement, { type: "table" }>["rowStyle"])
            : undefined,
        footerStyle:
          typeof props.footerStyle === "object" && props.footerStyle !== null
            ? (props.footerStyle as Record<string, unknown> as Extract<TemplateElement, { type: "table" }>["footerStyle"])
            : undefined,
        headerBackground: typeof props.headerBackground === "string" ? props.headerBackground : undefined,
        rowBackground: typeof props.rowBackground === "string" ? props.rowBackground : undefined,
        alternateRowBackground:
          typeof props.alternateRowBackground === "string" ? props.alternateRowBackground : undefined,
        footerBackground: typeof props.footerBackground === "string" ? props.footerBackground : undefined,
        borderStyle,
        borderColor: typeof props.borderColor === "string" ? props.borderColor : undefined,
        borderWidth: typeof props.borderWidth === "number" ? props.borderWidth : undefined,
        showFooter: typeof props.showFooter === "boolean" ? props.showFooter : undefined,
      });
      break;
    }
    case "spacer": {
      out.push({
        id: `${block.id}-spacer`,
        type: "spacer",
        ...base,
        showDivider: toBool(props.showDivider),
        dividerStyle: (props.dividerStyle as "solid" | "dashed" | "dotted") || "solid",
        dividerColor: toStr(props.dividerColor, "#d1d5db"),
        dividerWidth: toNum(props.dividerWidth, 1),
      });
      break;
    }
    case "pageBreak": {
      out.push({
        id: `${block.id}-pagebreak`,
        type: "pageBreak",
        ...base,
        breakType: (props.breakType as "always" | "avoid" | "auto") || "always",
        showInEditor: props.showInEditor === undefined ? true : toBool(props.showInEditor, true),
        style: (props.style as "line" | "dashed" | "none") || "dashed",
      });
      break;
    }
    case "qrCode": {
      out.push({
        id: `${block.id}-qr`,
        type: "qrCode",
        ...base,
        content: toStr(props.content, ""),
        binding: typeof props.binding === "string" ? props.binding : undefined,
        dataType: (props.dataType as "url" | "text" | "payment" | "custom") || "text",
        foregroundColor: toStr(props.foregroundColor, "#111827"),
        backgroundColor: toStr(props.backgroundColor, "#ffffff"),
        errorCorrection: (props.errorCorrection as "low" | "medium" | "high" | "ultra") || "medium",
        margin: toNum(props.margin, 2),
      });
      break;
    }
    case "barcode": {
      out.push({
        id: `${block.id}-barcode`,
        type: "barcode",
        ...base,
        value: toStr(props.value, ""),
        binding: typeof props.binding === "string" ? props.binding : undefined,
        format: (props.format as "CODE128" | "CODE39" | "EAN13" | "UPC") || "CODE128",
        color: toStr(props.color, "#111827"),
        backgroundColor: toStr(props.backgroundColor, "#ffffff"),
        showText: props.showText === undefined ? true : toBool(props.showText, true),
        textPosition: (props.textPosition as "top" | "bottom") || "bottom",
      });
      break;
    }
    case "signature": {
      out.push({
        id: `${block.id}-signature`,
        type: "signature",
        ...base,
        signatureType: (props.signatureType as "placeholder" | "image" | "drawn") || "placeholder",
        signatureImage: typeof props.signatureImage === "string" ? props.signatureImage : undefined,
        signatureName: typeof props.signatureName === "string" ? props.signatureName : undefined,
        signatureTitle: typeof props.signatureTitle === "string" ? props.signatureTitle : undefined,
        showDate: toBool(props.showDate),
        placeholderText: toStr(props.placeholderText, "Signature"),
      });
      break;
    }
    case "stamp": {
      out.push({
        id: `${block.id}-stamp`,
        type: "stamp",
        ...base,
        text: toStr(props.text, "PAID"),
        stampType: (props.stampType as "paid" | "overdue" | "draft" | "void" | "custom") || "paid",
        shape: (props.shape as "rectangle" | "circle" | "badge" | "custom") || "rectangle",
        size: toNum(props.size, Math.max(base.width, base.height)),
        fontFamily: toStr(props.fontFamily, "Inter"),
        fontSize: toNum(props.fontSize, 24),
        fontWeight: (props.fontWeight as "normal" | "medium" | "semibold" | "bold") || "bold",
        textColor: toStr(props.textColor, "#991b1b"),
        backgroundColor: toStr(props.backgroundColor, "#fee2e2"),
        opacity: toNum(props.opacity, 0.85),
        effect: (props.effect as "stamped" | "embossed" | "flat") || "stamped",
        pattern: (props.pattern as "diagonal-lines" | "dots" | "none") || "none",
      });
      break;
    }
    case "container": {
      out.push({
        id: `${block.id}-container`,
        type: "box",
        ...base,
        fill: toStr(props.backgroundColor, "#ffffff00"),
        stroke: toStr(props.borderColor, "#d1d5db"),
        strokeWidth: toNum(props.borderWidth, 0),
        radius: toNum(props.radius, 0),
        opacity: toNum(props.opacity, 1),
      });
      break;
    }
    case "columns": {
      out.push({
        id: `${block.id}-columns`,
        type: "box",
        ...base,
        fill: toStr(props.backgroundColor, "#ffffff00"),
        stroke: toStr(props.dividerColor, "#e5e7eb"),
        strokeWidth: toNum(props.dividerWidth, 0),
        radius: 0,
        opacity: 1,
      });
      break;
    }
    case "companySender":
    case "customerRecipient":
    case "invoiceDetails":
    case "totals":
    case "paymentTerms":
    case "notesTerms": {
      out.push({
        id: `${block.id}-composite`,
        type: "text",
        ...base,
        text: toStr(props.title, block.type),
        binding: typeof props.binding === "string" ? props.binding : undefined,
        typography: {
          fontFamily: "Inter",
          fontSize: toNum(props.fontSize, 12),
          fontWeight: "normal",
          fontStyle: "normal",
          lineHeight: 1.2,
          letterSpacing: 0,
          wordSpacing: 0,
          color: "#111827",
          align: "left",
          uppercase: false,
          lowercase: false,
          textDecoration: "none",
          textIndent: 0,
        },
        format: { kind: "none" },
        opacity: 1,
      });
      break;
    }
    default:
      break;
  }

  if (Array.isArray(block.children)) {
    for (const child of block.children as InvoiceBlock[]) {
      compileBlock(child, out, zIndex + 1);
    }
  }

  if (Array.isArray(block.columns)) {
    const columnDefs = block.columns as Array<{ id: string; width?: number; children?: InvoiceBlock[] }>;
    const gap = toNum(props.gap, 16);
    const totalWidth = columnDefs.reduce(
      (sum: number, c: { width?: number }) => sum + toNum(c.width, 100 / Math.max(1, columnDefs.length)),
      0
    );
    let cursorX = x;

    for (const col of columnDefs) {
      const colWeight = toNum(col.width, 100 / Math.max(1, columnDefs.length));
      const colWidth = totalWidth > 0 ? (width - gap * Math.max(0, columnDefs.length - 1)) * (colWeight / totalWidth) : width / Math.max(1, columnDefs.length);

      const colChildren = Array.isArray(col.children) ? col.children : [];
      for (const child of colChildren as InvoiceBlock[]) {
        const childProps = child.props ?? {};
        const nextProps = {
          ...childProps,
          x: toNum(childProps.x, cursorX),
          y: toNum(childProps.y, y),
          width: toNum(childProps.width, colWidth),
          height: toNum(childProps.height, height),
        };
        const nextChild: InvoiceBlock = { ...child, props: nextProps };
        compileBlock(nextChild, out, zIndex + 1);
      }

      cursorX += colWidth + gap;
    }
  }
}

export function compileInvoiceBlocksToElements(input: CompileInput): TemplateElement[] {
  const out: TemplateElement[] = [];
  for (const block of input.blocks) {
    compileBlock(block, out, 0);
  }

  return out.sort((a, b) => {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}
