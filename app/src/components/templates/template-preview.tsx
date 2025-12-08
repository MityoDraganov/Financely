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

/**
 * Format an address object into a readable string
 */
function formatAddress(value: unknown): string {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    
    const addr = value as Record<string, unknown>;
    const parts: string[] = [];
    
    if (addr.street && typeof addr.street === "string") parts.push(addr.street);
    if (addr.city && typeof addr.city === "string") parts.push(addr.city);
    if (addr.state && typeof addr.state === "string") parts.push(addr.state);
    if (addr.zipCode && typeof addr.zipCode === "string") parts.push(addr.zipCode);
    if (addr.country && typeof addr.country === "string") parts.push(addr.country);
    
    return parts.filter(Boolean).join(", ") || "";
}

function formatValue(value: unknown, kind: "none" | "currency" | "date", currency?: string, dateFormat?: string): string {
    if (value == null) return "";
    
    // Handle objects - check if it's an address-like object
    if (typeof value === "object" && !Array.isArray(value) && kind === "none") {
        // Check if it looks like an address object
        const obj = value as Record<string, unknown>;
        if (obj.street || obj.city || obj.state || obj.zipCode || obj.country) {
            return formatAddress(value);
        }
        // For other objects, try to format them nicely
        return Object.entries(obj)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(", ");
    }
    
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
        // Clamp element position and size to canvas boundaries to prevent overflow
        // Use Math.max to ensure values are never negative
        const clampedX = Math.max(0, Math.min(el.x, size.w - 1));
        const clampedY = Math.max(0, Math.min(el.y, size.h - 1));
        
        // Calculate maximum allowed dimensions based on clamped position
        const maxWidth = Math.max(0, size.w - clampedX);
        const maxHeight = Math.max(0, size.h - clampedY);
        
        // Clamp width and height to ensure element stays within canvas
        const clampedWidth = Math.max(0, Math.min(el.width, maxWidth));
        const clampedHeight = Math.max(0, Math.min(el.height, maxHeight));
        
        const commonStyle: React.CSSProperties = {
            position: "absolute",
            left: clampedX,
            top: clampedY,
            width: clampedWidth,
            height: clampedHeight,
            transform: `rotate(${el.rotation}deg)`,
            display: el.visible ? undefined : "none",
            zIndex: el.zIndex ?? 0,
            // Prevent any overflow beyond element bounds
            overflow: "hidden",
            boxSizing: "border-box",
        };

        if (el.type === "text") {
            const t = el as Extract<TemplateElement, { type: "text" }>;
            let display = t.text ?? "";
            if (t.binding) {
                const bound = getByPath<unknown>(context, t.binding);
                display = t.format
                    ? formatValue(bound, t.format.kind, t.format.currency, t.format.dateFormat)
                    : formatValue(bound, "none"); // Use formatValue to handle objects properly
            }
            return (
                <div key={t.id} style={commonStyle}>
                    <div
                        style={{
                            fontFamily: t.typography.fontFamily,
                            fontSize: t.typography.fontSize,
                            fontWeight: t.typography.fontWeight,
                            lineHeight: t.typography.lineHeight,
                            letterSpacing: t.typography.letterSpacing,
                            color: t.typography.color,
                            textAlign: t.typography.align,
                            textTransform: t.typography.uppercase ? "uppercase" : t.typography.lowercase ? "lowercase" : undefined,
                            whiteSpace: "pre-wrap",
                            width: "100%",
                            height: "100%",
                            overflow: "hidden",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            boxSizing: "border-box",
                        }}
                    >
                        {display}
                    </div>
                </div>
            );
        }

        if (el.type === "image") {
            const img = el as Extract<TemplateElement, { type: "image" }>;
            let imageSrc = img.src;
            
            // If there's a binding, try to get the value from context, otherwise use default src
            if (img.binding) {
                const boundValue = getByPath<string>(context, img.binding);
                if (boundValue) {
                    imageSrc = boundValue;
                }
            }
            
            return (
                <div key={img.id} style={commonStyle}>
                    {imageSrc ? (
                        <img 
                            src={imageSrc} 
                            alt={img.alt || ""} 
                            style={{ 
                                width: "100%", 
                                height: "100%", 
                                objectFit: img.objectFit,
                                display: "block",
                                maxWidth: "100%",
                                maxHeight: "100%",
                            }} 
                        />
                    ) : (
                        <div style={{ 
                            width: "100%", 
                            height: "100%", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            background: "#f3f4f6", 
                            color: "#6b7280", 
                            fontSize: 12,
                            overflow: "hidden",
                            boxSizing: "border-box",
                        }}>
                            No Image
                        </div>
                    )}
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
            const displayValue = boundValue != null ? formatValue(boundValue, "none") : "";
            
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
                            padding: `4px 8px`,
                            fontSize: 12,
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

        if (el.type === "currency") {
            const curr = el as Extract<TemplateElement, { type: "currency" }>;
            // Get the bound value from context
            const boundValue = curr.binding ? getByPath<unknown>(context, curr.binding) : undefined;
            
            // Format as currency
            let displayValue = "";
            if (boundValue != null) {
                const num = Number(boundValue);
                if (Number.isFinite(num)) {
                    const currency = curr.currency || "USD";
                    const formatter = new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency,
                    });
                    displayValue = formatter.format(num);
                } else {
                    displayValue = formatValue(boundValue, "none");
                }
            }
            
            // Determine text alignment
            const textAlign = curr.align || "left";
            
            return (
                <div key={curr.id} style={commonStyle}>
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: `4px 8px`,
                            fontSize: 12,
                            color: displayValue ? "#111827" : "#9ca3af",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            gap: `4px`,
                            textAlign,
                            overflow: "hidden",
                            boxSizing: "border-box",
                        }}
                    >
                        <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 500 }}>
                            {curr.currency || "USD"}
                        </span>
                        <span style={{ flex: 1 }}>
                            {displayValue || curr.placeholder || "0.00"}
                        </span>
                    </div>
                </div>
            );
        }

        if (el.type === "table") {
            const tbl = el as Extract<TemplateElement, { type: "table" }>;
            const items = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
            // Calculate dynamic table height based on actual content (no scrolling for PDF/print)
            const headerHeight = tbl.headerHeight;
            const minRowHeight = tbl.rowHeight;
            const actualContentHeight = items.length * minRowHeight;
            // Table height should be header + content (no clamping for PDF/print compatibility)
            const totalTableHeight = headerHeight + actualContentHeight;
            
            return (
                <div key={tbl.id} style={{ ...commonStyle, height: totalTableHeight }}>
                    <div style={{ width: "100%", height: "100%", fontSize: 10, color: "#374151", overflow: "visible", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "grid", gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width}px`).join(" ") : "1fr", borderBottom: "1px solid #e5e7eb", height: tbl.headerHeight }}>
                            {tbl.columns.map((c) => (
                                <div key={c.id} style={{ display: "flex", alignItems: "center", padding: `4px`, fontWeight: 600 }}>
                                    {c.header}
                                </div>
                            ))}
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: "visible" }}>
                            {items.map((row, idx) => (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width}px`).join(" ") : "1fr", borderBottom: tbl.stripe && idx % 2 === 1 ? "1px solid #f3f4f6" : "1px solid #e5e7eb", minHeight: tbl.rowHeight, padding: `4px 0` }}>
                                    {tbl.columns.map((c) => {
                                        const columnBinding = c.binding || c.id;
                                        const raw = getByPath<unknown>(row, columnBinding);
                                        
                                        // Handle currency type columns
                                        let text: string;
                                        if (c.type === "currency") {
                                            if (raw != null) {
                                                const num = Number(raw);
                                                if (Number.isFinite(num)) {
                                                    const currency = c.currency || c.format?.currency || "USD";
                                                    const formatter = new Intl.NumberFormat(undefined, {
                                                        style: "currency",
                                                        currency,
                                                    });
                                                    text = formatter.format(num);
                                                } else {
                                                    text = formatValue(raw, "none");
                                                }
                                            } else {
                                                text = "";
                                            }
                                        } else {
                                            text = formatValue(raw, c.format?.kind ?? "none", c.format?.currency, c.format?.dateFormat);
                                        }
                                        
                                        const justify = c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start";
                                        
                                        return (
                                            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: justify, padding: `4px`, wordBreak: "break-word", overflowWrap: "break-word", minHeight: `20px` }}>
                                                {text}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            
                            {/* Totaling Row - per column */}
                            {tbl.columns.some((c) => c.showTotal) && (
                                <div style={{ 
                                    display: "grid", 
                                    gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width}px`).join(" ") : "1fr", 
                                    borderBottom: "1px solid #e5e7eb",
                                    height: tbl.rowHeight,
                                }}>
                                    {tbl.columns.map((c) => {
                                        let text = "";
                                        const cellStyle: React.CSSProperties = {
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start",
                                            padding: `4px`,
                                        };
                                        
                                        if (c.showTotal && (c.type === "number" || c.type === "currency")) {
                                            try {
                                                // Sum all values in the column
                                                const columnBinding = c.binding || c.id;
                                                const columnValues = items
                                                    .map((row) => {
                                                        const val = getByPath<unknown>(row, columnBinding);
                                                        if (val != null) {
                                                            const num = Number(val);
                                                            return Number.isFinite(num) ? num : 0;
                                                        }
                                                        return 0;
                                                    })
                                                    .filter((v) => typeof v === "number");
                                                
                                                const sum = columnValues.reduce((s, v) => s + v, 0);
                                                
                                                // Apply column-specific formatting
                                                text = formatValue(sum, c.format?.kind ?? "none", c.currency || c.format?.currency, c.format?.dateFormat);
                                                
                                                // Apply total cell styling
                                                if (c.totalStyle) {
                                                    if (c.totalStyle.backgroundColor) {
                                                        cellStyle.backgroundColor = c.totalStyle.backgroundColor;
                                                    }
                                                    if (c.totalStyle.color) {
                                                        cellStyle.color = c.totalStyle.color;
                                                    }
                                                    if (c.totalStyle.fontWeight) {
                                                        cellStyle.fontWeight = c.totalStyle.fontWeight;
                                                    }
                                                    if (c.totalStyle.fontSize) {
                                                        cellStyle.fontSize = c.totalStyle.fontSize;
                                                    }
                                                    if (c.totalStyle.borderTop) {
                                                        cellStyle.borderTop = c.totalStyle.borderTop;
                                                    }
                                                } else {
                                                    // Default styling
                                                    cellStyle.backgroundColor = "#f9fafb";
                                                    cellStyle.fontWeight = "bold";
                                                    cellStyle.borderTop = "2px solid #111827";
                                                }
                                            } catch (error) {
                                                console.error("Error calculating column total:", error);
                                                text = "";
                                            }
                                        }
                                        
                                        return (
                                            <div key={c.id} style={cellStyle}>
                                                {text}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }

    // Generate watermark element if enabled
    const watermark = template.brand.watermark;
    let watermarkElement: React.ReactNode = null;
    if (watermark?.enabled) {
        // Only use the explicitly configured watermark image URL or text
        // Don't fallback to organization logo - that would be a separate feature
        const watermarkImageUrl = watermark.imageUrl;
        const watermarkText = watermark.text;
        
        // Calculate position
        let positionStyle: React.CSSProperties = {};
        if (watermark.x !== undefined && watermark.y !== undefined) {
            positionStyle = {
                left: watermark.x,
                top: watermark.y,
                transform: `translate(0, 0) rotate(${watermark.rotation}deg)`,
            };
        } else {
            const positions: Record<string, React.CSSProperties> = {
                "center": {
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) rotate(${watermark.rotation}deg)`,
                },
                "top-left": { left: 0, top: 0, transform: `rotate(${watermark.rotation}deg)` },
                "top-right": { right: 0, top: 0, transform: `rotate(${watermark.rotation}deg)` },
                "bottom-left": { left: 0, bottom: 0, transform: `rotate(${watermark.rotation}deg)` },
                "bottom-right": { right: 0, bottom: 0, transform: `rotate(${watermark.rotation}deg)` },
                "top-center": { left: "50%", top: 0, transform: `translateX(-50%) rotate(${watermark.rotation}deg)` },
                "bottom-center": { left: "50%", bottom: 0, transform: `translateX(-50%) rotate(${watermark.rotation}deg)` },
                "left-center": { left: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation}deg)` },
                "right-center": { right: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation}deg)` },
            };
            positionStyle = positions[watermark.position] || positions.center;
        }

        const width = watermark.width || 200;
        const height = watermark.height;
        const opacity = watermark.opacity ?? 0.1;
        const repeat = watermark.repeat || "none";

        if (watermarkImageUrl) {
            // Image watermark
            if (repeat === "none") {
                // Single image watermark
                watermarkElement = (
                    <div
                        style={{
                            position: "absolute",
                            ...positionStyle,
                            width,
                            height: height || width,
                            opacity,
                            pointerEvents: "none",
                            zIndex: 0,
                        }}
                    >
                        <img
                            src={watermarkImageUrl}
                            alt="Watermark"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                    </div>
                );
            } else {
                // Tiled/repeated image watermark
                const backgroundSize = repeat === "repeat" 
                    ? `${width}px ${height || width}px`
                    : repeat === "repeat-x"
                    ? `${width}px auto`
                    : `${width}px auto`; // repeat-y
                
                // Map repeat values to valid CSS background-repeat values
                const cssRepeat: React.CSSProperties["backgroundRepeat"] = 
                    repeat === "repeat" ? "repeat" :
                    repeat === "repeat-x" ? "repeat-x" :
                    repeat === "repeat-y" ? "repeat-y" :
                    "no-repeat";
                
                watermarkElement = (
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: "100%",
                            height: "100%",
                            backgroundImage: `url(${watermarkImageUrl})`,
                            backgroundRepeat: cssRepeat,
                            backgroundSize,
                            opacity,
                            pointerEvents: "none",
                            zIndex: 0,
                            transform: `rotate(${watermark.rotation || 0}deg)`,
                        }}
                    />
                );
            }
        } else if (watermarkText) {
            // Text watermarks don't support repeat (would require complex pattern generation)
            watermarkElement = (
                <div
                    style={{
                        position: "absolute",
                        ...positionStyle,
                        width,
                        minWidth: width,
                        opacity,
                        pointerEvents: "none",
                        zIndex: 0,
                        fontSize: Math.max(24, width / 10),
                        fontWeight: "bold",
                        color: "#999999",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                    }}
                >
                    {watermarkText}
                </div>
            );
        }
    }

    // Calculate the visual dimensions after scaling for container sizing
    const scaledWidth = size.w * zoom;
    const scaledHeight = size.h * zoom;
    
    return (
        <div 
            className="flex items-center justify-center w-full h-full"
            style={{
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Container that constrains the scaled canvas to its visual size */}
            <div
                style={{
                    // Size container to the visual (scaled) dimensions
                    width: scaledWidth,
                    height: scaledHeight,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Canvas at original size, scaled visually via transform */}
                <div
                    className="bg-white dark:bg-neutral-900 shadow relative border border-border"
                    style={{
                        // Original dimensions (layout box)
                        width: size.w,
                        height: size.h,
                        // Scale transform (visual size)
                        transform: `scale(${zoom})`,
                        transformOrigin: "center center",
                        // Prevent any content overflow
                        overflow: "hidden",
                        // Ensure proper rendering and performance
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                    }}
                >
                    {watermarkElement}
                    {(template.elements ?? []).map((el) => renderElement(el))}
                </div>
            </div>
        </div>
    );
}


