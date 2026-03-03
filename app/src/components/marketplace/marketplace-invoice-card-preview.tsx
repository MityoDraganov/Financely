import { useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { Template } from "@/core/entities/template";
import { PAGE_SIZES } from "@/utils/template-preview-utils";
import { paginateTemplate } from "@/utils/template-pagination";
import { resolveTemplateMarginsPx } from "@/utils/print-margins";
import { renderTemplateElement } from "@/components/templates/template-element-renderers";
import { renderWatermark } from "@/components/templates/template-watermark";
import { cn } from "@/lib/utils";

type MarketplaceInvoiceCardPreviewProps = {
  template: Template;
  className?: string;
};

function getPageSize(template: Template): { w: number; h: number } {
  const baseSize =
    template.pageSettings?.size === "Custom" && template.pageSettings.customSize
      ? {
          w: template.pageSettings.customSize.width,
          h: template.pageSettings.customSize.height,
        }
      : PAGE_SIZES[(template.pageSettings?.size ?? template.pageSize) as keyof typeof PAGE_SIZES] ??
        PAGE_SIZES.A4;

  return template.pageSettings?.orientation === "landscape"
    ? { w: baseSize.h, h: baseSize.w }
    : baseSize;
}

export function MarketplaceInvoiceCardPreview({
  template,
  className,
}: MarketplaceInvoiceCardPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (!containerRef.current) return;
      setContainerWidth(containerRef.current.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const size = useMemo(() => getPageSize(template), [template]);

  const firstPage = useMemo(() => {
    try {
      const pages = paginateTemplate(template, {}, size);
      return pages[0] ?? null;
    } catch {
      return null;
    }
  }, [template, size]);

  const margins = useMemo(
    () => resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins),
    [template]
  );

  const renderSize = useMemo(() => {
    if (!firstPage) return { w: size.w, h: size.h };

    const bounds = firstPage.elements.reduce(
      (acc, el) => {
        const right = Number.isFinite(el.x + el.width) ? el.x + el.width : acc.maxX;
        const bottom = Number.isFinite(el.y + el.height) ? el.y + el.height : acc.maxY;
        return {
          maxX: Math.max(acc.maxX, right),
          maxY: Math.max(acc.maxY, bottom),
        };
      },
      { maxX: 0, maxY: 0 }
    );

    return {
      w: Math.max(size.w, bounds.maxX),
      h: Math.max(size.h, bounds.maxY),
    };
  }, [firstPage, size.h, size.w]);

  const scale = useMemo(() => {
    if (containerWidth <= 0 || renderSize.w <= 0) return 1;
    const nextScale = (containerWidth - 1) / renderSize.w;
    return Math.max(0.08, Math.min(1, nextScale));
  }, [containerWidth, renderSize.w]);

  if (!template?.elements?.length || !firstPage) {
    return (
      <div className={cn("w-full h-full grid place-items-center bg-gray-50", className)}>
        <FileText className="h-10 w-10 text-gray-400" />
      </div>
    );
  }

  const renderContext = {
    context: {},
    page: firstPage,
    pageIndex: 0,
    pageSize: renderSize,
    templateElements: template.elements ?? [],
    margins,
  };

  const scaledWidth = renderSize.w * scale;
  const scaledHeight = renderSize.h * scale;
  const watermarkElement = template.brand?.watermark ? renderWatermark({ watermark: template.brand.watermark }) : null;

  return (
    <div ref={containerRef} className={cn("w-full h-full overflow-hidden bg-white", className)}>
      <div className="relative" style={{ width: scaledWidth, height: scaledHeight }}>
        <div
          className="bg-white"
          style={{
            width: renderSize.w,
            height: renderSize.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            overflow: "hidden",
            backgroundColor: template.pageSettings?.backgroundColor || undefined,
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {watermarkElement}
          {firstPage.elements.map((el) => renderTemplateElement(el, renderContext))}
        </div>
      </div>
    </div>
  );
}
