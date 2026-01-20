import { useParams, useNavigate } from "react-router-dom";
import { useMarketplaceTemplate } from "@/hooks/repository-hooks/use-marketplace-templates";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useIsMarketplaceTemplateAdded } from "@/hooks/use-is-marketplace-template-added";
import { ReviewSection } from "@/components/marketplace/review-section";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Star, Check, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { TemplateData } from "@/core/entities/template";
import { EmailTemplateData } from "@/core/entities/email-template";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useMarketplaceTemplate(id);
  const { data: currentOrganization } = useCurrentOrganization();
  const addTemplate = useAddMarketplaceTemplate();
  const [isAdding, setIsAdding] = useState(false);
  const isAdded = useIsMarketplaceTemplateAdded(template, currentOrganization?.id);

  // Create sample preview context for invoice templates
  const previewContext = useMemo(() => {
    if (!template || template.type !== "invoice") return {};
    
    const templateContent = template.templateContent as TemplateData;
    const context: Record<string, unknown> = {};
    
    // Extract bindings from template elements and create sample data
    if (templateContent.elements) {
      templateContent.elements.forEach((element: { binding?: string; [key: string]: unknown }) => {
        if (element.binding) {
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
  }, [template]);

  // Convert TemplateData to Template for preview (add id)
  const invoiceTemplateForPreview = useMemo(() => {
    if (!template || template.type !== "invoice") return null;
    const templateContent = template.templateContent as TemplateData;
    return {
      ...templateContent,
      id: template.id,
    };
  }, [template]);

  const handleAddTemplate = async () => {
    if (!currentOrganization?.id || !id || !template) {
      return;
    }

    setIsAdding(true);
    try {
      await addTemplate.mutateAsync({
        templateId: id,
        orgId: currentOrganization.id,
        templateType: template.type, // Pass template type for optimized refetch
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <p className="text-sm text-muted-foreground">Template not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate("/marketplace")}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-semibold text-foreground">{template.title}</h1>
                    {template.isFeatured && (
                      <Badge className="bg-primary/90 text-primary-foreground rounded-full px-2 py-0.5">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                    {template.isOfficial && (
                      <Badge variant="default" className="rounded-full px-2 py-0.5">
                        Official
                      </Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {template.type === "invoice" ? "Invoice Template" : "Email Template"}
                </Badge>
                {template.category && (
                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                    {template.category}
                  </Badge>
                )}
                {template.language && (
                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                    {template.language}
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                {template.ratingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-foreground">{template.ratingAverage.toFixed(1)}</span>
                    <span className="text-muted-foreground">({template.ratingCount} reviews)</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span>{template.downloadCount} downloads</span>
                </div>
              </div>
            </div>

            {/* Template Preview */}
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium">Template Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {template.type === "invoice" ? (
                  <div className="border rounded-lg p-4 bg-muted/50 dark:bg-muted/30 overflow-auto">
                    {invoiceTemplateForPreview ? (
                      <TemplatePreview
                        template={invoiceTemplateForPreview}
                        context={previewContext}
                        zoom={0.6}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        Preview not available
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-white dark:bg-neutral-900">
                    {template.templateContent && (template.templateContent as EmailTemplateData).htmlContent ? (
                      <div
                        className="email-preview"
                        dangerouslySetInnerHTML={{
                          __html: (template.templateContent as EmailTemplateData).htmlContent || "",
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        Preview not available
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Details */}
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium">Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {template.type === "invoice" ? "Invoice Template" : "Email Template"}
                    </span>
                  </div>
                  {template.category && (
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <span className="ml-2 font-medium text-foreground">{template.category}</span>
                    </div>
                  )}
                  {template.language && (
                    <div>
                      <span className="text-muted-foreground">Language:</span>
                      <span className="ml-2 font-medium text-foreground">{template.language}</span>
                    </div>
                  )}
                  {template.country && (
                    <div>
                      <span className="text-muted-foreground">Country:</span>
                      <span className="ml-2 font-medium text-foreground">{template.country}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="ml-2 font-medium text-foreground">{template.version}</span>
                  </div>
                  {template.publishedAt && (
                    <div>
                      <span className="text-muted-foreground">Published:</span>
                      <span className="ml-2 font-medium text-foreground">
                        {new Date(template.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {template.tags && template.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">Tags:</span>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs rounded-full px-2 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <ReviewSection templateId={template.id} />
          </div>

          {/* Sidebar - Sticky CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium">Get This Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>By</span>
                      <span className="font-medium text-foreground">
                        {template.isOfficial ? "Financely" : template.authorName}
                      </span>
                    </div>
                    {template.publishedAt && (
                      <div className="text-xs text-muted-foreground">
                        Published {new Date(template.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleAddTemplate}
                    disabled={isAdding || !currentOrganization?.id || isAdded}
                    variant={isAdded ? "secondary" : "default"}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Added to Organization
                      </>
                    ) : isAdding ? (
                      "Adding..."
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Add to My Organization
                      </>
                    )}
                  </Button>

                  {!currentOrganization?.id && (
                    <p className="text-xs text-muted-foreground text-center">
                      Please select an organization first
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
