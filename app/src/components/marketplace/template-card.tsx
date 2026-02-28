import { Star, Download, Sparkles, Check, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useIsMarketplaceTemplateAdded } from "@/hooks/use-is-marketplace-template-added";
import { TemplatePreview } from "@/components/templates/template-preview";
import { MarketplaceTemplate, TemplateData, EmailTemplateData } from "@/core";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getDefaultPrintMarginsPx } from "@/utils/print-margins";

interface TemplateCardProps {
  template: MarketplaceTemplate;
}

const TYPE_STYLES = {
  invoice: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    label: "Invoice",
  },
  email: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    label: "Email",
  },
} as const;

export function TemplateCard({ template }: TemplateCardProps) {
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const addTemplate = useAddMarketplaceTemplate();
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isAdded = useIsMarketplaceTemplateAdded(template, currentOrganization?.id);

  const canRenderPreview = useMemo(() => {
    if (!template.templateContent || typeof template.templateContent !== "object") return false;
    try {
      if (template.type === "invoice") {
        const content = template.templateContent as TemplateData;
        return !!(content?.elements && Array.isArray(content.elements) && content.elements.length > 0);
      } else {
        const content = template.templateContent as EmailTemplateData;
        return !!(content?.htmlContent && typeof content.htmlContent === "string" && content.htmlContent.length > 0);
      }
    } catch {
      return false;
    }
  }, [template]);

  const previewContext = useMemo(() => {
    if (template.type !== "invoice" || !canRenderPreview) return {};
    const templateContent = template.templateContent as TemplateData;
    const context: Record<string, unknown> = {};
    if (templateContent.elements && Array.isArray(templateContent.elements)) {
      templateContent.elements.forEach((element: { binding?: string; [key: string]: unknown }) => {
        if (element.binding && typeof element.binding === "string") {
          const b = element.binding;
          if (b.includes("seller")) context[b] = context[b] || "Sample Company";
          else if (b.includes("buyer")) context[b] = context[b] || "Sample Customer";
          else if (b.includes("invoiceNumber")) context[b] = "INV-001";
          else if (b.includes("total") || b.includes("subtotal")) context[b] = 1000;
          else if (b.includes("date")) context[b] = new Date().toISOString().split("T")[0];
          else context[b] = `[${b}]`;
        }
      });
    }
    return context;
  }, [template, canRenderPreview]);

  const invoiceTemplateForPreview = useMemo(() => {
    if (template.type !== "invoice" || !canRenderPreview) return null;
    try {
      const templateContent = template.templateContent as TemplateData;
      if (!templateContent.elements || !Array.isArray(templateContent.elements)) return null;
      return {
        ...templateContent,
        id: template.id,
        elements: templateContent.elements,
        pageSize: templateContent.pageSize || "A4",
        brand: templateContent.brand || {
          fonts: [],
          colors: { primary: "#000000", secondary: "#666666", accent: "#000000" },
          margins: getDefaultPrintMarginsPx(),
        },
      };
    } catch {
      return null;
    }
  }, [template, canRenderPreview]);

  const handleAddTemplate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentOrganization?.id) return;
    setIsAdding(true);
    try {
      await addTemplate.mutateAsync({
        templateId: template.id,
        orgId: currentOrganization.id,
        templateType: template.type,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const type = TYPE_STYLES[template.type] ?? TYPE_STYLES.invoice;
  const initials = (template.isOfficial ? "F" : template.authorName?.[0] ?? "?").toUpperCase();

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-white rounded-2xl overflow-hidden cursor-pointer",
        "border border-gray-100/80",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:border-gray-200"
      )}
      onClick={() => navigate(`/marketplace/${template.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Preview area ── */}
      <div className="relative h-44 bg-gray-50 overflow-hidden shrink-0">
        {template.previewImages && template.previewImages.length > 0 ? (
          <img
            src={template.previewImages[0]}
            alt={template.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : template.type === "invoice" && invoiceTemplateForPreview ? (
          <div className="w-full h-full bg-white overflow-hidden relative">
            <div
              className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]"
              style={{
                transform: "scale(0.35)",
                transformOrigin: "top left",
                width: "285.7%",
                height: "285.7%",
              }}
            >
              <TemplatePreview
                template={invoiceTemplateForPreview}
                context={previewContext}
                zoom={1}
              />
            </div>
          </div>
        ) : template.type === "email" && canRenderPreview ? (
          <div className="w-full h-full bg-white overflow-hidden relative">
            <iframe
              srcDoc={(template.templateContent as EmailTemplateData).htmlContent || ""}
              className="w-full h-full border-0 origin-top-left pointer-events-none transition-transform duration-500 group-hover:scale-[1.04]"
              style={{ width: "200%", height: "200%", transform: "scale(0.5)" }}
              title={`Preview of ${template.title}`}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          /* Placeholder */
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100/60 p-4 gap-3">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
              {template.type === "invoice" ? (
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <span className="text-[11px] font-medium text-gray-500 text-center line-clamp-2">
              {template.title}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/35 flex items-end justify-end p-3 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 shadow-sm">
            View details
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>

        {/* Status badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {template.isOfficial && (
            <span
              className="px-2 py-0.5 rounded-md text-white text-[10px] font-bold tracking-wide"
              style={{ background: "hsl(143,64%,22%)" }}
            >
              Official
            </span>
          )}
          {template.isFeatured && (
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[10px] font-bold flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              Featured
            </span>
          )}
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Type chip + category */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
              type.bg,
              type.text
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", type.dot)} />
            {type.label}
          </span>
          {template.category && (
            <span className="text-[10px] text-gray-400 font-medium truncate">
              {template.category}
            </span>
          )}
        </div>

        {/* Title & description */}
        <div className="flex-1 min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-1">
            {template.title}
          </h3>
          <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
            {template.shortDescription || template.description || "No description available"}
          </p>
        </div>

        {/* Author */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: "hsl(143,64%,30%)" }}
          >
            {initials}
          </div>
          <span className="text-[11px] text-gray-500 truncate">
            {template.isOfficial ? "Financely" : template.authorName}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Stats + action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {template.ratingCount > 0 && (
              <span className="flex items-center gap-1 text-[11px]">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-semibold text-gray-700">
                  {template.ratingAverage.toFixed(1)}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Download className="h-3 w-3 shrink-0" />
              {template.downloadCount}
            </span>
          </div>

          <button
            onClick={handleAddTemplate}
            disabled={isAdding || !currentOrganization?.id || isAdded}
            className={cn(
              "h-7 px-3 rounded-lg text-[11px] font-bold transition-all duration-150 shrink-0",
              isAdded
                ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
                : !currentOrganization?.id
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-700 active:scale-95"
            )}
          >
            {isAdded ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Added
              </span>
            ) : isAdding ? (
              "…"
            ) : (
              "Get"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
