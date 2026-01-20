import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Download, Sparkles, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useIsMarketplaceTemplateAdded } from "@/hooks/use-is-marketplace-template-added";
import { TemplatePreview } from "@/components/templates/template-preview";
import { MarketplaceTemplate, TemplateData, EmailTemplateData } from "@/core";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface TemplateCardProps {
  template: MarketplaceTemplate;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const addTemplate = useAddMarketplaceTemplate();
  const [isAdding, setIsAdding] = useState(false);
  const isAdded = useIsMarketplaceTemplateAdded(template, currentOrganization?.id);

  // Check if we can render a preview
  const canRenderPreview = useMemo(() => {
    if (!template.templateContent || typeof template.templateContent !== "object") {
      return false;
    }
    
    try {
      if (template.type === "invoice") {
        const content = template.templateContent as TemplateData;
        return !!(content && content.elements && Array.isArray(content.elements) && content.elements.length > 0);
      } else {
        const content = template.templateContent as EmailTemplateData;
        return !!(content && content.htmlContent && typeof content.htmlContent === "string" && content.htmlContent.length > 0);
      }
    } catch {
      return false;
    }
  }, [template]);

  // Create sample preview context for invoice templates
  const previewContext = useMemo(() => {
    if (template.type !== "invoice" || !canRenderPreview) return {};
    
    const templateContent = template.templateContent as TemplateData;
    const context: Record<string, unknown> = {};
    
    // Extract bindings from template elements and create sample data
    if (templateContent.elements && Array.isArray(templateContent.elements)) {
      templateContent.elements.forEach((element: { binding?: string; [key: string]: unknown }) => {
        if (element.binding && typeof element.binding === "string") {
          const bindingPath = element.binding;
          if (bindingPath.includes("seller")) {
            context[bindingPath] = context[bindingPath] || "Sample Company";
          } else if (bindingPath.includes("buyer")) {
            context[bindingPath] = context[bindingPath] || "Sample Customer";
          } else if (bindingPath.includes("invoiceNumber")) {
            context[bindingPath] = "INV-001";
          } else if (bindingPath.includes("total") || bindingPath.includes("subtotal")) {
            context[bindingPath] = 1000;
          } else if (bindingPath.includes("date")) {
            context[bindingPath] = new Date().toISOString().split("T")[0];
          } else {
            context[bindingPath] = `[${bindingPath}]`;
          }
        }
      });
    }
    
    return context;
  }, [template, canRenderPreview]);

  // Convert TemplateData to Template for preview (add id)
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
          margins: { top: 40, right: 40, bottom: 40, left: 40 },
        },
      };
    } catch {
      return null;
    }
  }, [template, canRenderPreview]);

  const handleAddTemplate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!currentOrganization?.id) {
      return;
    }

    setIsAdding(true);
    try {
      await addTemplate.mutateAsync({
        templateId: template.id,
        orgId: currentOrganization.id,
        templateType: template.type, // Pass template type for optimized refetch
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/marketplace/${template.id}`);
  };

  return (
    <Card
      className={cn(
        "group flex flex-col h-full cursor-pointer transition-all overflow-hidden",
        "hover:shadow-md hover:border-primary/20",
        "border shadow-sm rounded-2xl"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="p-0 relative">
        {/* Preview Area */}
        <div className="aspect-video bg-muted/30 relative overflow-hidden">
          {template.previewImages && template.previewImages.length > 0 ? (
            <img
              src={template.previewImages[0]}
              alt={template.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : template.type === "invoice" && invoiceTemplateForPreview ? (
            <div className="w-full h-full bg-white dark:bg-neutral-900 overflow-hidden relative">
              <div className="absolute inset-0" style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285.7%", height: "285.7%" }}>
                <TemplatePreview
                  template={invoiceTemplateForPreview}
                  context={previewContext}
                  zoom={1}
                />
              </div>
            </div>
          ) : template.type === "email" && canRenderPreview ? (
            <div className="w-full h-full bg-white dark:bg-neutral-900 overflow-hidden relative">
              <iframe
                srcDoc={(template.templateContent as EmailTemplateData).htmlContent || ""}
                className="w-full h-full border-0 scale-50 origin-top-left"
                style={{ width: "200%", height: "200%" }}
                title={`Preview of ${template.title}`}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-muted/50 dark:bg-muted/30 p-4">
              <div className="text-center">
                <div className="text-sm font-semibold text-foreground mb-1 line-clamp-2">{template.title}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {template.type === "invoice" ? "Invoice Template" : "Email Template"}
                </div>
                {template.category && (
                  <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5">{template.category}</Badge>
                )}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center mt-2">
                    {template.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Featured Badge */}
          {template.isFeatured && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-primary/90 text-primary-foreground shadow-md rounded-full px-2 py-0.5">
                <Sparkles className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}

          {/* Official Badge */}
          {template.isOfficial && (
            <div className="absolute top-2 left-2">
              <Badge variant="default" className="shadow-md rounded-full px-2 py-0.5">
                Official
              </Badge>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold line-clamp-2 leading-tight">
              {template.title}
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2 min-h-10 text-muted-foreground">
              {template.shortDescription || template.description || "No description available"}
            </CardDescription>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs rounded-full px-2 py-0.5">
              {template.isOfficial ? "Financely" : template.authorName}
            </Badge>
            <Badge variant="outline" className="text-xs rounded-full px-2 py-0.5">
              {template.type === "invoice" ? "Invoice" : "Email"}
            </Badge>
            {template.category && (
              <Badge variant="outline" className="text-xs rounded-full px-2 py-0.5">
                {template.category}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0 space-y-3">
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {template.ratingCount > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-foreground">
                {template.ratingAverage.toFixed(1)}
              </span>
              <span>({template.ratingCount})</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            <span>{template.downloadCount}</span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="w-full transition-all"
          onClick={handleAddTemplate}
          disabled={isAdding || !currentOrganization?.id || isAdded}
          variant={isAdded ? "secondary" : "default"}
        >
          {isAdded ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Added
            </>
          ) : isAdding ? (
            "Adding..."
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Get Template
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
