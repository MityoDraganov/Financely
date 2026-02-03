import React from "react";
import type { Template } from "@/core/entities/template";
import { paginateTemplate, type RenderPage } from "@/utils/template-pagination";
import { PAGE_SIZES } from "@/utils/template-preview-utils";
import { renderTemplateElement } from "./template-element-renderers";
import { renderWatermark } from "./template-watermark";

type InvoicePreviewContext = unknown;

interface TemplatePreviewProps {
  readonly template: Template;
  readonly context: InvoicePreviewContext;
  readonly zoom?: number;
}

export function TemplatePreview({
  template,
  context,
  zoom = 0.75,
}: TemplatePreviewProps) {
  const size = PAGE_SIZES[template.pageSize] ?? PAGE_SIZES.A4;
  const pages = React.useMemo(
    () => paginateTemplate(template, context, size),
    [template, context, size]
  );
  const scaledWidth = size.w * zoom;
  const scaledHeight = size.h * zoom;
  const watermarkElement = template.brand.watermark
    ? renderWatermark({ watermark: template.brand.watermark })
    : null;
  const margins = template.brand?.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };

  const renderPage = (page: RenderPage) => {
    const renderContext = {
      context,
      page,
      pageIndex: page.pageIndex,
      pageSize: size,
      templateElements: template.elements ?? [],
      margins,
    };
    return (
      <div
        key={page.pageIndex}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          maxWidth: "100%",
          maxHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          marginBottom: page.pageIndex < pages.length - 1 ? "20px" : 0,
        }}
      >
        <div
          className="bg-white dark:bg-neutral-900 shadow relative border border-border"
          style={{
            width: size.w,
            height: size.h,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            overflow: "hidden",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {watermarkElement}
          {page.elements.map((el) => renderTemplateElement(el, renderContext))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ minWidth: 0, position: "relative", padding: "20px" }}
    >
      {pages.map(renderPage)}
    </div>
  );
}
