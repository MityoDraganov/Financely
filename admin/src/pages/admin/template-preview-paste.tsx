import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileJson, AlertCircle } from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { Template, TemplateElement } from "@/core/entities/template";

type RawElement = Record<string, unknown>;

function normalizeElement(el: RawElement): TemplateElement | null {
  const type = el.type as string;
  if (!type || !["text", "image", "table", "box", "line", "input", "currency"].includes(type)) {
    return null;
  }
  const base = {
    id: String(el.id ?? `el-${Math.random().toString(36).slice(2, 9)}`),
    type: type as TemplateElement["type"],
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    width: Number(el.width) || 100,
    height: Number(el.height) || 24,
    rotation: Number(el.rotation) || 0,
    zIndex: Number(el.zIndex) || 0,
    visible: el.visible !== false,
  };

  if (type === "line") {
    const lineEl = el as { x2?: number; y2?: number; stroke?: string; strokeWidth?: number; borderColor?: string };
    return {
      ...base,
      type: "line",
      x2: lineEl.x2 ?? base.x + base.width,
      y2: lineEl.y2 ?? base.y,
      stroke: lineEl.stroke ?? lineEl.borderColor ?? "#e5e7eb",
      strokeWidth: lineEl.strokeWidth ?? 1,
    } as TemplateElement;
  }

  if (type === "table") {
    const t = el as { columns?: RawElement[]; itemsBinding?: string; rowHeight?: number; headerHeight?: number; stripe?: boolean };
    const columns = (t.columns ?? []).map((c, i) => ({
      id: String((c as RawElement).id ?? `col-${i}`),
      header: String((c as RawElement).header ?? "Column"),
      width: Number((c as RawElement).width) || 80,
      align: ((c as RawElement).align as "left" | "center" | "right") ?? "left",
      type: ((c as RawElement).type as "text" | "number" | "date" | "currency") ?? "text",
      binding: (c as RawElement).binding as string | undefined,
      calc: (c as RawElement).calc as string | undefined,
      format: ((c as RawElement).format as { kind?: string; currency?: string; dateFormat?: string }) ?? { kind: "none" as const },
      currency: (c as RawElement).currency as string | undefined,
      showTotal: Boolean((c as RawElement).showTotal),
    }));
    return {
      ...base,
      type: "table",
      rowHeight: t.rowHeight ?? 28,
      headerHeight: t.headerHeight ?? 28,
      stripe: t.stripe ?? false,
      columns,
      itemsBinding: t.itemsBinding ?? "items",
      designRows: [],
    } as TemplateElement;
  }

  if (type === "text") {
    const t = el as { text?: string; binding?: string; typography?: Record<string, unknown>; format?: { kind?: string; currency?: string; dateFormat?: string } };
    const typo = t.typography ?? {};
    return {
      ...base,
      type: "text",
      text: String(t.text ?? ""),
      binding: t.binding as string | undefined,
      padding: 0,
      opacity: 1,
      typography: {
        fontFamily: String(typo.fontFamily ?? "Inter"),
        fontSize: Number(typo.fontSize) || 12,
        fontWeight: (["normal", "medium", "semibold", "bold"].includes(String(typo.fontWeight)) ? String(typo.fontWeight) : typeof typo.fontWeight === "number" ? (typo.fontWeight >= 700 ? "bold" : typo.fontWeight >= 600 ? "semibold" : "normal") : "normal") as "normal" | "medium" | "semibold" | "bold",
        lineHeight: Number(typo.lineHeight) || 1.2,
        letterSpacing: Number(typo.letterSpacing) || 0,
        color: String(typo.color ?? "#111827"),
        align: (["left", "center", "right"].includes(String(typo.align)) ? String(typo.align) : "left") as "left" | "center" | "right",
        uppercase: Boolean(typo.uppercase),
        lowercase: Boolean(typo.lowercase),
      },
      format: t.format ? { kind: (t.format.kind as "none" | "currency" | "date") ?? "none", currency: t.format.currency, dateFormat: t.format.dateFormat } : { kind: "none" as const },
    } as TemplateElement;
  }

  if (type === "image") {
    const t = el as { src?: string; binding?: string; objectFit?: string; alt?: string };
    return {
      ...base,
      type: "image",
      src: String(t.src ?? ""),
      objectFit: (["contain", "cover", "fill", "none"].includes(String(t.objectFit)) ? t.objectFit : "contain") as "contain" | "cover" | "fill" | "none",
      alt: t.alt as string | undefined,
      binding: t.binding as string | undefined,
    } as TemplateElement;
  }

  if (type === "box") {
    const t = el as { fill?: string; stroke?: string; strokeWidth?: number; radius?: number };
    return {
      ...base,
      type: "box",
      fill: String(t.fill ?? "#ffffff00"),
      stroke: String(t.stroke ?? "#e5e7eb"),
      strokeWidth: Number(t.strokeWidth) ?? 1,
      radius: Number(t.radius) ?? 0,
      opacity: 1,
    } as TemplateElement;
  }

  if (type === "input") {
    const t = el as { placeholder?: string; binding?: string; variant?: string; align?: string };
    return {
      ...base,
      type: "input",
      placeholder: String(t.placeholder ?? ""),
      binding: t.binding as string | undefined,
      variant: (["text", "number", "date"].includes(String(t.variant)) ? t.variant : "text") as "text" | "number" | "date",
      align: (["left", "center", "right"].includes(String(t.align)) ? t.align : "left") as "left" | "center" | "right",
    } as TemplateElement;
  }

  if (type === "currency") {
    const t = el as { placeholder?: string; binding?: string; currency?: string; mode?: string; formula?: string; align?: string };
    return {
      ...base,
      type: "currency",
      placeholder: String(t.placeholder ?? ""),
      binding: t.binding as string | undefined,
      currency: String(t.currency ?? "USD").slice(0, 3),
      currencyLinks: [],
      mode: (["independent", "linked", "formula"].includes(String(t.mode)) ? t.mode : "independent") as "independent" | "linked" | "formula",
      formula: t.formula as string | undefined,
      align: (["left", "center", "right"].includes(String(t.align)) ? t.align : "right") as "left" | "center" | "right",
    } as TemplateElement;
  }

  return null;
}

function normalizePastedData(raw: unknown): Template | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const elementsRaw = (d.elements as RawElement[] | undefined) ?? [];
  const elements: TemplateElement[] = [];
  for (const el of elementsRaw) {
    const normalized = normalizeElement(el);
    if (normalized) elements.push(normalized);
  }

  const brand = d.brand as Record<string, unknown> | undefined;
  const margins = brand?.margins as Record<string, number> | undefined;
  const now = new Date().toISOString();

  const template: Template = {
    id: "preview-paste",
    createdAt: now,
    updatedAt: now,
    orgId: String(d.orgId || "preview"),
    name: String(d.name ?? "Untitled"),
    description: d.description != null ? String(d.description) : undefined,
    pageSize: (d.pageSize === "Letter" ? "Letter" : "A4") as "A4" | "Letter",
    brand: {
      fonts: Array.isArray(brand?.fonts) ? (brand.fonts as string[]) : ["Inter"],
      colors:
        brand?.colors && typeof brand.colors === "object"
          ? {
              primary: String((brand.colors as Record<string, unknown>).primary ?? "#111827"),
              secondary: String((brand.colors as Record<string, unknown>).secondary ?? "#6b7280"),
              accent: String((brand.colors as Record<string, unknown>).accent ?? "#2563eb"),
            }
          : { primary: "#111827", secondary: "#6b7280", accent: "#2563eb" },
      margins: margins
        ? { top: margins.top ?? 40, right: margins.right ?? 40, bottom: margins.bottom ?? 40, left: margins.left ?? 40 }
        : { top: 40, right: 40, bottom: 40, left: 40 },
    },
    elements,
    status: "draft",
    compliance: (d.compliance as Template["compliance"]) ?? undefined,
  };
  return template;
}

function buildSampleContext(template: Template): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  const push = (path: string, value: unknown) => {
    const parts = path.split(".");
    let cur: Record<string, unknown> = ctx;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!(key in cur) || typeof cur[key] !== "object") cur[key] = {};
      cur = cur[key] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  };

  const sampleItems = [
    { description: "Sample product or service", quantity: 2, unitPrice: 75, lineTotal: 150 },
    { description: "Another line item", quantity: 1, unitPrice: 50, lineTotal: 50 },
  ];
  const subtotal = 200;
  const taxTotal = 0;
  const total = 200;

  for (const el of template.elements ?? []) {
    if (el.type === "text" || el.type === "input" || el.type === "currency") {
      const binding = (el as { binding?: string }).binding;
      if (!binding) continue;
      if (binding === "items") continue;
      if (binding.includes("seller")) {
        if (binding === "seller.name") push(binding, "Sample Company LLC");
        else if (binding === "seller.address") push(binding, "123 Business Rd.\nCity, State, 90210");
        else if (binding === "seller.logoUrl") continue;
        else push(binding, "Sample Company");
      } else if (binding.includes("customer") || binding.includes("buyer")) {
        if (binding === "customer.name") push(binding, "Acme Corp Inc.");
        else if (binding === "customer.address") push(binding, "456 Client Lane\nMetropolis, NY, 10001");
        else push(binding, "Sample Customer");
      } else if (binding === "invoiceNumber") push(binding, "INV-0001");
      else if (binding === "invoiceDate") push(binding, new Date().toISOString().split("T")[0]);
      else if (binding === "subtotal") push(binding, subtotal);
      else if (binding === "taxTotal" || binding === "vatTotal") push(binding, taxTotal);
      else if (binding === "total" || binding === "grossTotal") push(binding, total);
      else if (binding === "currency") push(binding, "USD");
      else if (binding === "netAmount") push(binding, subtotal);
    }
    if (el.type === "table" && (el as { itemsBinding?: string }).itemsBinding) {
      push((el as { itemsBinding: string }).itemsBinding, sampleItems);
    }
  }

  if (!("items" in ctx)) ctx.items = sampleItems;
  if (!("subtotal" in ctx)) ctx.subtotal = subtotal;
  if (!("total" in ctx)) ctx.total = total;
  if (!("taxTotal" in ctx)) ctx.taxTotal = taxTotal;

  return ctx;
}

export function AdminTemplatePreviewPastePage() {
  const [rawInput, setRawInput] = useState("");

  const { template, context, parseError } = useMemo(() => {
    if (!rawInput.trim()) return { template: null as Template | null, context: {} as Record<string, unknown>, parseError: null as string | null };
    try {
      const parsed = JSON.parse(rawInput) as unknown;
      const template = normalizePastedData(parsed);
      if (!template) {
        return { template: null, context: {}, parseError: "Invalid template structure (missing name, brand, or elements)." };
      }
      const context = buildSampleContext(template);
      return { template, context, parseError: null };
    } catch (e) {
      return { template: null, context: {}, parseError: e instanceof SyntaxError ? "Invalid JSON" : "Failed to parse" };
    }
  }, [rawInput]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileJson className="h-8 w-8" />
          Template Preview
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
      <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Rendered invoice with sample data. Scroll to see full page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {template ? (
              <div className="border rounded-lg bg-muted/30 overflow-auto min-h-[500px] max-h-[85vh]">
                <TemplatePreview template={template} context={context} zoom={0.7} />
              </div>
            ) : (
              <div className="border rounded-lg bg-muted/30 flex items-center justify-center min-h-[400px] text-muted-foreground">
                {rawInput.trim() ? "Fix JSON errors to see preview." : "Paste TemplateData JSON and preview will appear here."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paste JSON</CardTitle>
            <CardDescription>
              Paste the full TemplateData object (e.g. from the LLM prompt output).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-json">TemplateData JSON</Label>
              <Textarea
                id="template-json"
                placeholder='{"name": "My Invoice", "pageSize": "A4", "brand": {...}, "elements": [...]}'
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="font-mono text-sm min-h-[320px]"
              />
            </div>
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

   
      </div>
    </div>
  );
}
