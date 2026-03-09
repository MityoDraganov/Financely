import { Star, Download, Sparkles, Check, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useIsMarketplaceTemplateAdded } from "@/hooks/use-is-marketplace-template-added";
import { MarketplaceInvoiceCardPreview } from "@/components/marketplace/marketplace-invoice-card-preview";
import { MarketplaceTemplate, TemplateData, EmailTemplateData } from "@/core";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getDefaultPrintMarginsPx } from "@/utils/print-margins";

interface TemplateCardProps {
  template: MarketplaceTemplate;
}

const TYPE_STYLES = {
  invoice: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    label: "Invoice",
  },
  email: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
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
  const [hasPreviewImageError, setHasPreviewImageError] = useState(false);
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
  const previewImageUrl = template.previewImages?.[0];

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-card text-card-foreground rounded-2xl overflow-hidden cursor-pointer",
        "border border-border",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:border-border/80"
      )}
      onClick={() => navigate(`/marketplace/${template.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Preview area ── */}
      <div className="relative h-44 bg-muted/40 overflow-hidden shrink-0">
        {template.type === "invoice" && invoiceTemplateForPreview ? (
          <div className="w-full h-full bg-background overflow-hidden relative">
            <div
              className="absolute inset-0"
            >
              <MarketplaceInvoiceCardPreview
                template={invoiceTemplateForPreview}
                className="h-full"
              />
            </div>
          </div>
        ) : template.type === "email" && canRenderPreview ? (
          <div className="w-full h-full bg-background overflow-hidden relative">
            <iframe
              srcDoc={(template.templateContent as EmailTemplateData).htmlContent || ""}
              className="w-full h-full border-0 origin-top-left pointer-events-none transition-transform duration-500 group-hover:scale-[1.04]"
              style={{ width: "300%", height: "300%", transform: "scale(0.3333)" }}
              title={`Preview of ${template.title}`}
              sandbox="allow-same-origin"
            />
          </div>
        ) : previewImageUrl && !hasPreviewImageError ? (
          <img
            src={previewImageUrl}
            alt={template.title}
            className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setHasPreviewImageError(true)}
          />
        ) : (
          /* Placeholder */
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-muted/40 to-muted/70 p-4 gap-3">
            <div className="w-12 h-12 rounded-xl bg-background shadow-sm flex items-center justify-center border border-border/60">
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
            <span className="text-[11px] font-medium text-muted-foreground text-center line-clamp-2">
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
          <span className="inline-flex items-center gap-1 bg-background/95 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-sm">
            View details
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>

        {/* Status badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {template.isOfficial && (
            <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
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
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {template.category}
            </span>
          )}
        </div>

        {/* Title & description */}
        <div className="flex-1 min-h-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
            {template.title}
          </h3>
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
            {template.shortDescription || template.description || "No description available"}
          </p>
        </div>

        {/* Author */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0 bg-primary"
          >
            {initials}
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            {template.isOfficial ? "Financely" : template.authorName}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Stats + action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {template.ratingCount > 0 && (
              <span className="flex items-center gap-1 text-[11px]">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-semibold text-foreground">
                  {template.ratingAverage.toFixed(1)}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 cursor-default"
                : !currentOrganization?.id
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
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
