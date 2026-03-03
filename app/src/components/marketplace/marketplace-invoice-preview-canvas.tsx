import { useEffect, useMemo, useRef, useState } from "react";
import { Template, TemplateElement } from "@/core";
import { WatermarkRenderer } from "@/components/designer/watermark-renderer";
import {
  TextElement,
  ImageElement,
  BoxElement,
  LineElement,
  IconElement,
  InputElement,
  TableElement,
  PathElement,
} from "@/components/designer/elements";
import CurrencyElement from "@/components/designer/elements/currency";
import { PAGE_SIZES_PX } from "@/utils/page-size-presets";
import { cn } from "@/lib/utils";
import { getElementBorderRadiusCss, getElementPaddingCss } from "@/utils/element-box-model";

type MarketplaceInvoicePreviewCanvasProps = {
  template: Template;
  className?: string;
};

function getPageDimensions(template: Template): { width: number; height: number } {
  const pageSettings = template.pageSettings;
  const sizeKey =
    pageSettings?.size && pageSettings.size !== "Custom"
      ? pageSettings.size
      : template.pageSize ?? "A4";
  const base =
    pageSettings?.size === "Custom" && pageSettings.customSize
      ? {
          width: pageSettings.customSize.width,
          height: pageSettings.customSize.height,
        }
      : {
          width: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.w ?? PAGE_SIZES_PX.A4.w,
          height: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.h ?? PAGE_SIZES_PX.A4.h,
        };

  if (pageSettings?.orientation === "landscape") {
    return { width: base.height, height: base.width };
  }

  return base;
}

export function MarketplaceInvoicePreviewCanvas({
  template,
  className,
}: MarketplaceInvoicePreviewCanvasProps) {
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageDimensions = useMemo(() => getPageDimensions(template), [template]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateZoom = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const horizontalPadding = 64; // p-8
      const availableWidth = Math.max(240, containerWidth - horizontalPadding);
      const nextZoom = availableWidth / pageDimensions.width;
      setZoom(Math.max(0.25, Math.min(1.2, nextZoom)));
    };

    updateZoom();
    const observer = new ResizeObserver(updateZoom);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [pageDimensions.width]);

  const elements = useMemo(
    () =>
      [...(template.elements ?? [])]
        .filter((el) => el.visible !== false)
        .sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10)),
    [template.elements]
  );

  return (
    <div ref={containerRef} className={cn("w-full max-h-[75vh] overflow-auto", className)}>
      <div className="relative bg-muted/30 p-8">
        <div className="grid place-items-center min-h-full">
          <div
            className="bg-white dark:bg-neutral-900 shadow-2xl relative rounded-sm isolate"
            style={{
              width: pageDimensions.width * zoom,
              height: pageDimensions.height * zoom,
              backgroundColor: template.pageSettings?.backgroundColor || undefined,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <WatermarkRenderer template={template} zoom={zoom} />
            {elements.map((el) => {
              const elementPaddingCss = getElementPaddingCss(el);
              const elementBorderRadiusCss = getElementBorderRadiusCss(el);
              const wrapperStyle: React.CSSProperties = {
                left: el.x * zoom,
                top: el.y * zoom,
                width: el.width * zoom,
                height: el.type === "table" ? "auto" : el.height * zoom,
                minHeight: el.type === "table" ? (el.headerHeight + el.rowHeight) * zoom : undefined,
                transform: `rotate(${el.rotation}deg)`,
                boxSizing: "border-box",
                padding: elementPaddingCss,
                borderRadius: elementBorderRadiusCss,
                overflow: el.type === "table" ? "visible" : elementBorderRadiusCss ? "hidden" : undefined,
                zIndex: el.zIndex ?? 10,
              };

              return (
                <div key={el.id} className="absolute select-none" style={wrapperStyle}>
                  {el.type === "text" && (
                    <TextElement element={el as Extract<TemplateElement, { type: "text" }>} zoom={zoom} />
                  )}
                  {el.type === "input" && (
                    <InputElement element={el as Extract<TemplateElement, { type: "input" }>} />
                  )}
                  {el.type === "image" && (
                    <ImageElement element={el as Extract<TemplateElement, { type: "image" }>} />
                  )}
                  {el.type === "box" && (
                    <BoxElement element={el as Extract<TemplateElement, { type: "box" }>} />
                  )}
                  {el.type === "line" && (
                    <LineElement element={el as Extract<TemplateElement, { type: "line" }>} />
                  )}
                  {el.type === "icon" && (
                    <IconElement element={el as Extract<TemplateElement, { type: "icon" }>} />
                  )}
                  {el.type === "currency" && (
                    <CurrencyElement element={el as Extract<TemplateElement, { type: "currency" }>} zoom={zoom} />
                  )}
                  {el.type === "table" && (
                    <TableElement
                      element={el as Extract<TemplateElement, { type: "table" }>}
                      zoom={zoom}
                      onHeaderChange={() => {}}
                    />
                  )}
                  {el.type === "spacer" && (() => {
                    const spacer = el as Extract<TemplateElement, { type: "spacer" }>;
                    return (
                      <div className="w-full h-full flex items-center">
                        {spacer.showDivider ? (
                          <div
                            className="w-full"
                            style={{
                              borderTopWidth: spacer.dividerWidth,
                              borderTopStyle: spacer.dividerStyle,
                              borderTopColor: spacer.dividerColor,
                            }}
                          />
                        ) : (
                          <div className="w-full h-full opacity-40 bg-slate-100 border border-dashed border-slate-300" />
                        )}
                      </div>
                    );
                  })()}
                  {el.type === "pageBreak" && (() => {
                    const pageBreak = el as Extract<TemplateElement, { type: "pageBreak" }>;
                    if (pageBreak.showInEditor === false) return null;
                    return (
                      <div className="w-full h-full flex items-center">
                        <div
                          className="w-full text-center text-[10px] uppercase tracking-wide text-orange-600"
                          style={{
                            borderTop:
                              pageBreak.style === "none"
                                ? "none"
                                : pageBreak.style === "line"
                                ? "1px solid #f97316"
                                : "1px dashed #f97316",
                          }}
                        >
                          <span className="bg-white px-1 relative -top-2">Page Break</span>
                        </div>
                      </div>
                    );
                  })()}
                  {el.type === "qrCode" && (() => {
                    const qr = el as Extract<TemplateElement, { type: "qrCode" }>;
                    return (
                      <div
                        className="w-full h-full grid place-items-center text-[10px] font-semibold"
                        style={{
                          background: qr.backgroundColor,
                          color: qr.foregroundColor,
                          border: "1px solid #d1d5db",
                        }}
                      >
                        QR
                      </div>
                    );
                  })()}
                  {el.type === "barcode" && (() => {
                    const barcode = el as Extract<TemplateElement, { type: "barcode" }>;
                    return (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center gap-1"
                        style={{ background: barcode.backgroundColor, color: barcode.color }}
                      >
                        <div
                          className="w-[92%] h-[60%]"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(to right, currentColor 0, currentColor 2px, transparent 2px, transparent 4px)",
                          }}
                        />
                        {barcode.showText && (
                          <div className="text-[10px] tracking-widest">{barcode.value || "BARCODE"}</div>
                        )}
                      </div>
                    );
                  })()}
                  {el.type === "signature" && (() => {
                    const signature = el as Extract<TemplateElement, { type: "signature" }>;
                    return (
                      <div className="w-full h-full flex flex-col justify-end">
                        {signature.signatureType === "image" && signature.signatureImage ? (
                          <img src={signature.signatureImage} alt="Signature" className="max-h-[70%] object-contain object-left" />
                        ) : (
                          <div className="text-[10px] text-slate-500 mb-1">
                            {signature.placeholderText || "Signature"}
                          </div>
                        )}
                        <div
                          style={{
                            borderBottomWidth: signature.borderBottom?.width ?? 1,
                            borderBottomStyle: signature.borderBottom?.style ?? "solid",
                            borderBottomColor: signature.borderBottom?.color ?? "#111827",
                          }}
                        />
                      </div>
                    );
                  })()}
                  {el.type === "stamp" && (() => {
                    const stamp = el as Extract<TemplateElement, { type: "stamp" }>;
                    return (
                      <div
                        className="w-full h-full flex items-center justify-center uppercase tracking-wide"
                        style={{
                          color: stamp.textColor,
                          background: stamp.backgroundColor,
                          opacity: stamp.opacity,
                          borderRadius: stamp.shape === "circle" ? "9999px" : 8,
                          border: stamp.border
                            ? `${stamp.border.width}px ${stamp.border.style} ${stamp.border.color}`
                            : "1px solid currentColor",
                          fontFamily: stamp.fontFamily,
                          fontWeight: stamp.fontWeight,
                          fontSize: stamp.fontSize,
                        }}
                      >
                        {stamp.text}
                      </div>
                    );
                  })()}
                  {el.type === "path" && (
                    <PathElement element={el as Extract<TemplateElement, { type: "path" }>} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
