import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  useExtractInvoiceData,
  useExtractionJob 
} from "@/hooks/service-hooks/use-invoice-extraction";
import { useGenerateTemplateFromExtraction } from "@/hooks/service-hooks/use-generate-template-from-extraction";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCreateInvoice } from "@/hooks/use-invoice";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { InvoiceFileUpload } from "@/components/invoice-extraction/invoice-file-upload";
import { ExtractionJobStatus } from "@/components/invoice-extraction/extraction-job-status";
import { ExtractionResultsPanel } from "@/components/invoice-extraction/extraction-results-panel";
import { TemplatePreviewDialog } from "@/components/invoice-extraction/template-preview-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, FileText } from "lucide-react";
import AppLayout from "@/components/layout";
import { findMatchingTemplates } from "@/utils/template-matching";
import { templateService } from "@/services/template-service";
import { toast } from "sonner";
import type { TemplateData, Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";

type FlowType = "template" | "invoice";

export default function InvoiceUploadFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine flow type from location state or default to "template"
  const flowType: FlowType = (location.state?.flowType as FlowType) || "template";
  const returnTo = (location.state?.returnTo as string) || (flowType === "template" ? "/templates" : "/invoices");

  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates = [] } = useTemplates(currentOrganization?.id);
  const createInvoice = useCreateInvoice();

  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "extract" | "match" | "preview" | "complete">("upload");
  const [matchedTemplates, setMatchedTemplates] = useState<Array<{ template: Template; confidence: number; reason: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<TemplateData | null>(null);
  const [templateQuality, setTemplateQuality] = useState<{ overall: number; layout: number; text: number; table: number; font: number } | null>(null);
  const [templateNeedsReview, setTemplateNeedsReview] = useState(false);
  const [templateReviewReasons, setTemplateReviewReasons] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [updatedExtractedData, setUpdatedExtractedData] = useState<Record<string, InvoiceDataValue> | undefined>(undefined);
  const [editedExtractedData, setEditedExtractedData] = useState<Record<string, InvoiceDataValue> | undefined>(undefined);

  const extractMutation = useExtractInvoiceData();
  const generateTemplate = useGenerateTemplateFromExtraction();
  const { data: job, isLoading: isLoadingJob } = useExtractionJob(jobId);

  const isInitialLoading = isLoadingJob && jobId && !job;

  const handleUploadSuccess = (uploadedJobId: string) => {
    setJobId(uploadedJobId);
    setStep("extract");
    setTimeout(() => {
      extractMutation.mutate(uploadedJobId);
    }, 500);
  };

  // Auto-extract when job is uploaded and pending
  useEffect(() => {
    if (job && job.status === "pending" && !extractMutation.isPending && extractMutation.isIdle) {
      extractMutation.mutate(job.id);
    }
  }, [job, extractMutation]);

  // Check for template matches when extraction completes
  useEffect(() => {
    if (job && job.status === "extracted" && flowType === "invoice" && step === "extract") {
      const matches = findMatchingTemplates(job, templates);
      if (matches.length > 0 && matches[0].confidence > 0.5) {
        setMatchedTemplates(matches);
        setStep("match");
        setSelectedTemplateId(matches[0].template.id);
      } else {
        // No good match, proceed to template generation
        setStep("preview");
      }
    } else if (job && job.status === "extracted" && flowType === "template" && step === "extract") {
      // For template flow, always generate template
      setStep("preview");
    }
  }, [job, templates, flowType, step]);

  const handleGenerateTemplate = async (editedData?: Record<string, unknown>) => {
    if (!jobId) return;

    // Store edited data if provided
    if (editedData) {
      setEditedExtractedData(editedData as Record<string, InvoiceDataValue>);
    }

    try {
      const result = await generateTemplate.mutateAsync({
        jobId,
        editedData,
        options: {
          style: "modern",
          templateName: `Template from ${job?.fileName || "Invoice"}`,
          strategy: "layout_fusion_v2",
          qualityTarget: "pixel",
        },
        createTemplate: false, // Don't create yet, show preview first
      });

      setGeneratedTemplate(result.template);
      setTemplateQuality(result.quality);
      setTemplateNeedsReview(result.needsReview);
      setTemplateReviewReasons(result.reviewReasons);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to generate template:", error);
    }
  };

  const handleAcceptTemplate = async (updatedData?: Record<string, InvoiceDataValue>, updatedTemplate?: TemplateData) => {
    if (!generatedTemplate || !currentOrganization) return;

    try {
      // Store updated data if provided
      if (updatedData) {
        setUpdatedExtractedData(updatedData);
      }

      // Use updated template if provided, otherwise use generated template
      const templateToCreate = updatedTemplate || generatedTemplate;

      // Create template
      const templateId = await templateService.createDraft(templateToCreate);
      
      setShowPreview(false);

      if (flowType === "invoice") {
        // Create invoice using the new template
        setStep("complete");
        await handleCreateInvoiceFromExtraction(templateId, updatedData);
      } else {
        // Template flow - just navigate back
        toast.success("Template created successfully");
        navigate(returnTo);
      }
    } catch (error) {
      toast.error("Failed to create template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleEditTemplate = (updatedTemplate?: TemplateData) => {
    if (!generatedTemplate || !currentOrganization) return;

    // Use updated template if provided, otherwise use generated template
    const templateToCreate = updatedTemplate || generatedTemplate;

    // Create template first, then navigate to designer
    templateService.createDraft(templateToCreate).then((templateId) => {
      setShowPreview(false);
      navigate(`/designer/${templateId}`);
    }).catch((error) => {
      toast.error("Failed to create template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    });
  };

  const handleCreateInvoiceFromExtraction = async (templateId: string, data?: Record<string, InvoiceDataValue>) => {
    const invoiceData = data || updatedExtractedData || job?.extractedData;
    if (!invoiceData || !currentOrganization) return;

    try {
      const result = await createInvoice.mutateAsync({
        orgId: currentOrganization.id,
        templateId,
        data: invoiceData,
        status: "draft",
      });

      toast.success("Invoice created successfully");
      navigate(`/invoices/${result.id}`);
    } catch (error) {
      toast.error("Failed to create invoice", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleUseMatchedTemplate = async () => {
    if (!selectedTemplateId || !job?.extractedData) return;

    setStep("complete");
    await handleCreateInvoiceFromExtraction(selectedTemplateId);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(returnTo)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {flowType === "template" ? "Create Template from Invoice" : "Create Invoice from Upload"}
            </h1>
            <p className="text-muted-foreground">
              {flowType === "template" 
                ? "Upload an invoice to generate a reusable template"
                : "Upload an invoice to automatically create an invoice"}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3 text-sm mb-8">
          <div className={`flex items-center gap-2 transition-colors ${step !== "upload" ? "text-foreground" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              step !== "upload" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "bg-muted text-muted-foreground"
            }`}>
              {step !== "upload" ? <CheckCircle2 className="h-4 w-4" /> : "1"}
            </div>
            <span className="font-medium">Upload</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 transition-colors ${["extract", "match", "preview", "complete"].includes(step) ? "text-foreground" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              ["extract", "match", "preview", "complete"].includes(step)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}>
              {["match", "preview", "complete"].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : "2"}
            </div>
            <span className="font-medium">Extract</span>
          </div>
          {flowType === "invoice" && (
            <>
              <div className="w-12 h-px bg-border" />
              <div className={`flex items-center gap-2 transition-colors ${["match", "preview", "complete"].includes(step) ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  ["match", "preview", "complete"].includes(step)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {["preview", "complete"].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : "3"}
                </div>
                <span className="font-medium">Match</span>
              </div>
            </>
          )}
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 transition-colors ${step === "complete" ? "text-foreground" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              step === "complete"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}>
              {step === "complete" ? <CheckCircle2 className="h-4 w-4" /> : flowType === "template" ? "3" : "4"}
            </div>
            <span className="font-medium">Complete</span>
          </div>
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Upload Invoice File
              </CardTitle>
              <CardDescription>
                Upload a PDF or image file of your invoice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceFileUpload
                onUploadSuccess={handleUploadSuccess}
                maxSizeMB={20}
              />
            </CardContent>
          </Card>
        )}

        {/* Extract Step */}
        {step === "extract" && jobId && (
          <Card>
            <CardHeader>
              <CardTitle>Extraction Status</CardTitle>
              <CardDescription>
                Extracting data from your invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInitialLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ExtractionJobStatus jobId={jobId} showDetails={true} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Template Match Step (Invoice Flow Only) */}
        {step === "match" && matchedTemplates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Template Match Found</CardTitle>
              <CardDescription>
                We found a matching template for this invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Found {matchedTemplates.length} matching template{matchedTemplates.length > 1 ? "s" : ""}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                {matchedTemplates.slice(0, 3).map((match, idx) => (
                  <div
                    key={match.template.id}
                    className={`cursor-pointer transition-all border rounded-md p-4 bg-background hover:bg-muted/50 ${
                      selectedTemplateId === match.template.id ? "ring-2 ring-primary border-primary" : "border-border"
                    }`}
                    onClick={() => setSelectedTemplateId(match.template.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{match.template.name}</div>
                        <div className="text-sm text-muted-foreground">{match.reason}</div>
                      </div>
                      <Badge variant={idx === 0 ? "default" : "secondary"}>
                        {(match.confidence * 100).toFixed(0)}% match
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUseMatchedTemplate}
                  disabled={!selectedTemplateId || createInvoice.isPending}
                  className="flex-1"
                >
                  {createInvoice.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Invoice...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Use This Template
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("preview")}
                >
                  Generate New Template
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview/Generate Step */}
        {step === "preview" && job && job.status === "extracted" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Extracted Data</CardTitle>
                <CardDescription>
                  {flowType === "template" 
                    ? "Review and configure the template structure. Field values will be set when creating invoices from this template."
                    : "Review the extracted data and generate a template. You can edit both field names and values."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.extractedData ? (
                  <ExtractionResultsPanel 
                    job={job}
                    flowType={flowType}
                    onGenerateTemplate={handleGenerateTemplate}
                    isGenerating={generateTemplate.isPending}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center p-8">
                    No data extracted yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {generatedTemplate && (
              <TemplatePreviewDialog
                open={showPreview}
                onOpenChange={setShowPreview}
                template={generatedTemplate}
                quality={templateQuality || undefined}
                needsReview={templateNeedsReview}
                reviewReasons={templateReviewReasons}
                extractedData={(editedExtractedData || job.extractedData) as Record<string, InvoiceDataValue>}
                flowType={flowType}
                onAccept={handleAcceptTemplate}
                onEdit={handleEditTemplate}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
