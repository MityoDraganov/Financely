import { Template, TemplateElement } from "@/core";
import React from "react";

type InvoicePreviewContext = unknown;

function getByPath<T>(obj: unknown, path: string): T | null {
    if (!obj || !path) return null;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const key of parts) {
        if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return null;
        }
    }
    return current as T;
}

function formatValue(value: unknown, kind: "none" | "currency" | "date", currency?: string, dateFormat?: string): string {
    if (value == null) return "";
    if (kind === "none") return String(value);
    if (kind === "currency") {
        const num = Number(value);
        const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" });
        return Number.isFinite(num) ? formatter.format(num) : String(value);
    }
    if (kind === "date") {
        const d = new Date(String(value));
        if (isNaN(d.getTime())) return String(value);
        try {
            if (dateFormat) {
                // Minimal support for common formats
                if (dateFormat === "YYYY-MM-DD") {
                    return d.toISOString().slice(0, 10);
                }
            }
            return d.toLocaleDateString();
        } catch {
            return d.toLocaleDateString();
        }
    }
    return String(value);
}

export function TemplatePreview({ template, context, zoom = 0.75 }: { template: Template; context: InvoicePreviewContext; zoom?: number }) {
    const PAGE_SIZES: Record<Template["pageSize"], { w: number; h: number }> = {
        A4: { w: 794, h: 1123 },
        Letter: { w: 816, h: 1056 },
    };
    const size = PAGE_SIZES[template.pageSize] ?? PAGE_SIZES.A4;

    function renderElement(el: TemplateElement) {
        const commonStyle: React.CSSProperties = {
            position: "absolute",
            left: el.x * zoom,
            top: el.y * zoom,
            width: el.width * zoom,
            height: el.height * zoom,
            transform: `rotate(${el.rotation}deg)`,
            display: el.visible ? undefined : "none",
            zIndex: el.zIndex ?? 0,
        };

        if (el.type === "text") {
            const t = el as Extract<TemplateElement, { type: "text" }>;
            let display = t.text ?? "";
            if (t.binding) {
                const bound = getByPath<unknown>(context, t.binding);
                display = t.format
                    ? formatValue(bound, t.format.kind, t.format.currency, t.format.dateFormat)
                    : String(bound ?? "");
            }
            return (
                <div key={t.id} style={commonStyle}>
                    <div
                        style={{
                            fontFamily: t.typography.fontFamily,
                            fontSize: t.typography.fontSize * zoom,
                            fontWeight: t.typography.fontWeight,
                            lineHeight: t.typography.lineHeight,
                            letterSpacing: t.typography.letterSpacing,
                            color: t.typography.color,
                            textAlign: t.typography.align,
                            textTransform: t.typography.uppercase ? "uppercase" : t.typography.lowercase ? "lowercase" : undefined,
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {display}
                    </div>
                </div>
            );
        }

        if (el.type === "image") {
            const img = el as Extract<TemplateElement, { type: "image" }>;
            return (
                <div key={img.id} style={commonStyle}>
                    <img src={img.src} alt={img.alt || ""} style={{ width: "100%", height: "100%", objectFit: img.objectFit }} />
                </div>
            );
        }

        if (el.type === "box") {
            const b = el as Extract<TemplateElement, { type: "box" }>;
            return (
                <div key={b.id} style={{ ...commonStyle, background: b.fill, border: `${b.strokeWidth}px solid ${b.stroke}`, borderRadius: b.radius }} />
            );
        }

        if (el.type === "line") {
            const ln = el as Extract<TemplateElement, { type: "line" }>;
            return (
                <div key={ln.id} style={commonStyle}>
                    <div style={{ borderTop: `${ln.strokeWidth}px solid ${ln.stroke}`, position: "absolute", left: 0, right: 0, top: "50%" }} />
                </div>
            );
        }

        if (el.type === "input") {
            const inp = el as Extract<TemplateElement, { type: "input" }>;
            // Get the bound value from context
            const boundValue = inp.binding ? getByPath<unknown>(context, inp.binding) : undefined;
            const displayValue = boundValue != null ? String(boundValue) : "";
            
            // Determine text alignment
            const textAlign = inp.align || "left";
            
            return (
                <div key={inp.id} style={commonStyle}>
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: `${4 * zoom}px ${8 * zoom}px`,
                            fontSize: 12 * zoom,
                            color: displayValue ? "#111827" : "#9ca3af",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            textAlign,
                            overflow: "hidden",
                            boxSizing: "border-box",
                        }}
                    >
                        {displayValue || inp.placeholder || ""}
                    </div>
                </div>
            );
        }

        if (el.type === "table") {
            const tbl = el as Extract<TemplateElement, { type: "table" }>;
            const items = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
            return (
                <div key={tbl.id} style={commonStyle}>
                    <div style={{ width: "100%", height: "100%", fontSize: 10 * zoom, color: "#374151", overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width * zoom}px`).join(" ") : "1fr", borderBottom: "1px solid #e5e7eb", height: tbl.headerHeight * zoom }}>
                            {tbl.columns.map((c) => (
                                <div key={c.id} style={{ display: "flex", alignItems: "center", padding: `${4 * zoom}px`, fontWeight: 600 }}>
                                    {c.header}
                                </div>
                            ))}
                        </div>
                        <div style={{ height: `calc(100% - ${tbl.headerHeight * zoom}px)`, overflow: "hidden" }}>
                            {items.map((row, idx) => (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width * zoom}px`).join(" ") : "1fr", borderBottom: tbl.stripe && idx % 2 === 1 ? "1px solid #f3f4f6" : "1px solid #e5e7eb", height: tbl.rowHeight * zoom }}>
                                    {tbl.columns.map((c) => {
                                        const columnBinding = c.binding || c.id;
                                        const raw = getByPath<unknown>(row, columnBinding);
                                        const text = formatValue(raw, c.format?.kind ?? "none", c.format?.currency, c.format?.dateFormat);
                                        const justify = c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start";
                                        
                                        return (
                                            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: justify, padding: `${4 * zoom}px` }}>
                                                {text}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }

    return (
        <div className="grid place-items-center">
            <div
                className="bg-white shadow relative border"
                style={{ width: size.w * zoom, height: size.h * zoom }}
            >
                {(template.elements ?? []).map((el) => renderElement(el))}
            </div>
        </div>
    );
}


