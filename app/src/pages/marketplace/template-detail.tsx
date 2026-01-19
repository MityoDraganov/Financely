import { useParams, useNavigate } from "react-router-dom";
import { useMarketplaceTemplate } from "@/hooks/repository-hooks/use-marketplace-templates";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { ReviewSection } from "@/components/marketplace/review-section";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Star, FileText, Mail, Check } from "lucide-react";
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
  const [added, setAdded] = useState(false);

  // Create sample preview context for invoice templates
  const previewContext = useMemo(() => {
    if (!template || template.type !== "invoice") return {};
    
    const templateContent = template.templateContent as TemplateData;
    const context: Record<string, unknown> = {};
    
    // Extract bindings from template elements and create sample data
    if (templateContent.elements) {
      templateContent.elements.forEach((element: { binding?: string; [key: string]: unknown }) => {
        if (element.binding) {
          // Create sample values based on binding path
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
      id: template.id, // Add id required by Template type
    };
  }, [template]);

  const handleAddTemplate = async () => {
    if (!currentOrganization?.id || !id) {
      return;
    }

    setIsAdding(true);
    try {
      await addTemplate.mutateAsync({
        templateId: id,
        orgId: currentOrganization.id,
      });
      setAdded(true);
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-muted-foreground">Template not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate("/marketplace")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Marketplace
      </Button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Preview Images */}
        <div className="flex-1">
          {template.previewImages && template.previewImages.length > 0 ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={template.previewImages[0]}
                alt={template.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              {template.type === "invoice" ? (
                <FileText className="h-24 w-24 text-muted-foreground" />
              ) : (
                <Mail className="h-24 w-24 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Template Info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{template.title}</h1>
            {template.description && (
              <p className="text-muted-foreground">{template.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={template.isOfficial ? "default" : "secondary"}>
              {template.isOfficial ? "Official" : template.authorName}
            </Badge>
            <Badge variant="outline">
              {template.type === "invoice" ? "Invoice Template" : "Email Template"}
            </Badge>
            {template.category && <Badge variant="outline">{template.category}</Badge>}
            {template.language && <Badge variant="outline">{template.language}</Badge>}
          </div>

          <div className="flex items-center gap-4 text-sm">
            {template.ratingCount > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{template.ratingAverage.toFixed(1)}</span>
                <span className="text-muted-foreground">({template.ratingCount} reviews)</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>{template.downloadCount} downloads</span>
            </div>
          </div>

          <Button
            className="w-full lg:w-auto"
            size="lg"
            onClick={handleAddTemplate}
            disabled={isAdding || !currentOrganization?.id || added}
          >
            {added ? (
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
        </div>
      </div>

      {/* Template Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Template Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {template.type === "invoice" ? (
            <div className="border rounded-lg p-4 bg-muted/50 overflow-auto">
              {invoiceTemplateForPreview ? (
                <TemplatePreview
                  template={invoiceTemplateForPreview}
                  context={previewContext}
                  zoom={0.6}
                />
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Preview not available
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-white">
              {template.templateContent && (template.templateContent as EmailTemplateData).htmlContent ? (
                <div
                  className="email-preview"
                  dangerouslySetInnerHTML={{
                    __html: (template.templateContent as EmailTemplateData).htmlContent || "",
                  }}
                />
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Preview not available
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Details */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Template Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Type:</span>
            <span className="ml-2 font-medium">
              {template.type === "invoice" ? "Invoice Template" : "Email Template"}
            </span>
          </div>
          {template.category && (
            <div>
              <span className="text-muted-foreground">Category:</span>
              <span className="ml-2 font-medium">{template.category}</span>
            </div>
          )}
          {template.language && (
            <div>
              <span className="text-muted-foreground">Language:</span>
              <span className="ml-2 font-medium">{template.language}</span>
            </div>
          )}
          {template.country && (
            <div>
              <span className="text-muted-foreground">Country:</span>
              <span className="ml-2 font-medium">{template.country}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Version:</span>
            <span className="ml-2 font-medium">{template.version}</span>
          </div>
          {template.publishedAt && (
            <div>
              <span className="text-muted-foreground">Published:</span>
              <span className="ml-2 font-medium">
                {new Date(template.publishedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {template.tags && template.tags.length > 0 && (
          <div>
            <span className="text-muted-foreground text-sm">Tags:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <ReviewSection templateId={template.id} />
    </div>
  );
}
