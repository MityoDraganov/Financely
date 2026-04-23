import { Component, ErrorInfo, ReactNode } from "react";
import { FileText } from "lucide-react";
import type { Template } from "@/core/entities/template";
import { PAGE_SIZES } from "@/utils/template-preview-utils";
import { renderTemplateElement } from "./template-element-renderers";
import { paginateTemplate } from "@/utils/template-pagination";
import { resolveTemplateMarginsPx } from "@/utils/print-margins";

interface Props {
  template: Template;
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class TemplateCardPreviewErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Template preview error for template:", this.props.template.id, error, errorInfo);
    console.error("Template data:", this.props.template);
  }

  public render() {
    if (this.state.hasError) {
      console.warn("Template preview failed, showing fallback for:", this.props.template.id, this.state.error?.message);
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <FileText className="h-16 w-16 text-muted-foreground" />
        </div>
      );
    }

    return this.props.children;
  }
}

interface TemplateCardPreviewProps {
  template: Template;
}

export function TemplateCardPreview({ template }: TemplateCardPreviewProps) {
  // Validate template has required properties
  if (!template || !template.elements) {
    console.warn("Template missing required properties:", template?.id);
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <FileText className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  const renderPreview = () => {
    try {
      // Get page size
      const baseSize =
        template.pageSettings?.size === "Custom" && template.pageSettings.customSize
          ? {
              w: template.pageSettings.customSize.width,
              h: template.pageSettings.customSize.height,
            }
          : PAGE_SIZES[(template.pageSettings?.size ?? template.pageSize) as keyof typeof PAGE_SIZES] ?? PAGE_SIZES.A4;

      const size = template.pageSettings?.orientation === "landscape"
        ? { w: baseSize.h, h: baseSize.w }
        : baseSize;

      // Paginate to get first page elements
      const pages = paginateTemplate(template, {}, size);
      const firstPage = pages[0];

      if (!firstPage) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <FileText className="h-16 w-16 text-muted-foreground" />
          </div>
        );
      }

      // Get margins
      const margins = resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins);

      const renderContext = {
        context: {},
        page: firstPage,
        pageIndex: 0,
        pageSize: size,
        templateElements: template.elements ?? [],
        margins,
      };

      // Calculate scale to fit full width in card
      // Card width is ~360px, A4 is ~794px
      const scale = 0.45; // 794 * 0.45 ≈ 357px (fits full width)

      const scaledWidth = size.w * scale;
      const scaledHeight = size.h * scale;

      return (
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: "relative",
            overflow: "hidden",
            borderRadius: "8px",
            willChange: "transform",
            backfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          <div
            style={{
              width: size.w,
              height: size.h,
              backgroundColor: template.pageSettings?.backgroundColor || "#ffffff",
              position: "relative",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              overflow: "hidden",
              borderRadius: `${8 / scale}px`,
              willChange: "transform",
              backfaceVisibility: "hidden",
              WebkitFontSmoothing: "antialiased",
            }}
            className="bg-white dark:bg-neutral-900"
          >
            {firstPage.backgroundElements.map((el) =>
              renderTemplateElement(el, renderContext)
            )}
            {firstPage.elements.map((el) =>
              renderTemplateElement(el, renderContext)
            )}
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error rendering template card preview:", error);
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <FileText className="h-16 w-16 text-muted-foreground" />
        </div>
      );
    }
  };

  return (
    <TemplateCardPreviewErrorBoundary template={template}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
          paddingTop: "16px"
        }}
      >
        {renderPreview()}
      </div>
    </TemplateCardPreviewErrorBoundary>
  );
}
