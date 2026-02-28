import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  useExtractInvoiceData,
  useExtractionJob 
} from "@/hooks/service-hooks/use-invoice-extraction";
import { useGenerateTemplateFromInvoiceFile } from "@/hooks/service-hooks/use-generate-template-from-extraction";
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
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Check, CheckCircle2, ChevronsUpDown, FileText, Loader2, Sparkles } from "lucide-react";
import AppLayout from "@/components/layout";
import { cn } from "@/lib/utils";
import { findMatchingTemplates } from "@/utils/template-matching";
import { functionsService } from "@/services/functions/functions-service";
import { templateService } from "@/services/template-service";
import { toast } from "sonner";
import type { TemplateData, Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";

type FlowType = "template" | "invoice";
type ModelProvider = "gemini" | "openai";
type RoutingProvider = "auto" | ModelProvider;

type AiModel = {
  provider: ModelProvider;
  id: string;
  displayName: string;
};

type TaskRoutingState = {
  provider: RoutingProvider;
  model: string;
};

function ModelSelector({
  label,
  value,
  models,
  loading,
  disabled,
  onChange,
}: {
  label: string;
  value: TaskRoutingState;
  models: AiModel[];
  loading: boolean;
  disabled?: boolean;
  onChange: (next: TaskRoutingState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedModel = useMemo(
    () => models.find((model) => model.provider === value.provider && model.id === value.model),
    [models, value.model, value.provider],
  );

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return models;

    return models.filter((model) => {
      const haystack = `${model.provider} ${model.displayName} ${model.id}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [models, searchQuery]);

  const geminiModels = filteredModels.filter((model) => model.provider === "gemini");
  const openAiModels = filteredModels.filter((model) => model.provider === "openai");

  const currentLabel =
    value.provider === "auto" || value.model === "auto"
      ? "Auto"
      : selectedModel
        ? `${selectedModel.displayName} (${selectedModel.provider})`
        : `${value.provider}:${value.model}`;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate text-left">
              {loading ? "Loading models..." : currentLabel}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search models..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup heading="Mode">
                <CommandItem
                  value="auto"
                  onSelect={() => {
                    onChange({ provider: "auto", model: "auto" });
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span className="flex-1">Auto</span>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value.provider === "auto" || value.model === "auto"
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              </CommandGroup>
              {geminiModels.length > 0 && (
                <CommandGroup heading="Gemini">
                  {geminiModels.map((model) => (
                    <CommandItem
                      key={`gemini:${model.id}`}
                      value={`gemini ${model.displayName} ${model.id}`}
                      onSelect={() => {
                        onChange({ provider: "gemini", model: model.id });
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <span className="flex-1 truncate">{model.displayName}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value.provider === "gemini" && value.model === model.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {openAiModels.length > 0 && (
                <CommandGroup heading="OpenAI">
                  {openAiModels.map((model) => (
                    <CommandItem
                      key={`openai:${model.id}`}
                      value={`openai ${model.displayName} ${model.id}`}
                      onSelect={() => {
                        onChange({ provider: "openai", model: model.id });
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <span className="flex-1 truncate">{model.displayName}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value.provider === "openai" && value.model === model.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
  const [updatedExtractedData, setUpdatedExtractedData] = useState<Record<string, InvoiceDataValue> | undefined>(undefined);
  const [editedExtractedData, setEditedExtractedData] = useState<Record<string, InvoiceDataValue> | undefined>(undefined);
  const [extractionTaskConfig, setExtractionTaskConfig] = useState<TaskRoutingState>({
    provider: "auto",
    model: "auto",
  });
  const [templateTaskConfig, setTemplateTaskConfig] = useState<TaskRoutingState>({
    provider: "auto",
    model: "auto",
  });

  const extractMutation = useExtractInvoiceData();
  const generateTemplateFromInvoiceFile = useGenerateTemplateFromInvoiceFile();
  const { data: job, isLoading: isLoadingJob } = useExtractionJob(jobId);
  const {
    data: aiModelsData,
    isLoading: isAiModelsLoading,
    isError: isAiModelsError,
    refetch: refetchAiModels,
  } = useQuery({
    queryKey: ["ai-models", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        throw new Error("Organization not found");
      }
      return functionsService.listAiModels({
        organizationId: currentOrganization.id,
      });
    },
    enabled: !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isInitialLoading = isLoadingJob && jobId && !job;
  const aiModels = aiModelsData?.models || [];

  const toRuntimeAiSelection = (taskConfig: TaskRoutingState): {
    provider: RoutingProvider;
    model: string;
  } => ({
    provider: taskConfig.provider,
    model:
      taskConfig.provider === "auto"
        ? "auto"
        : taskConfig.model.trim() || "auto",
  });

  const handleUploadSuccess = (uploadedJobId: string) => {
    setJobId(uploadedJobId);
    if (flowType === "template") {
      setStep("preview");
      void handleGenerateTemplate(undefined, uploadedJobId);
      return;
    }

    setStep("extract");
    setTimeout(() => {
      extractMutation.mutate({
        jobId: uploadedJobId,
        ai: toRuntimeAiSelection(extractionTaskConfig),
      });
    }, 500);
  };

  // Auto-extract when job is uploaded and pending
  useEffect(() => {
    if (flowType !== "invoice") return;
    if (job && job.status === "pending" && !extractMutation.isPending && extractMutation.isIdle) {
      extractMutation.mutate({
        jobId: job.id,
        ai: toRuntimeAiSelection(extractionTaskConfig),
      });
    }
  }, [job, extractMutation, flowType, extractionTaskConfig]);

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
    }
  }, [job, templates, flowType, step]);

  const handleGenerateTemplate = async (
    editedData?: Record<string, unknown>,
    explicitJobId?: string
  ) => {
    const targetJobId = explicitJobId || jobId;
    if (!targetJobId) return;

    // Store edited data if provided
    if (editedData) {
      setEditedExtractedData(editedData as Record<string, InvoiceDataValue>);
    }

    try {
      const result = await generateTemplateFromInvoiceFile.mutateAsync({
        jobId: targetJobId,
        editedData,
        ai: toRuntimeAiSelection(templateTaskConfig),
        options: {
          style: "modern",
          templateName: `Template from ${job?.fileName || "Invoice"}`,
        },
        createTemplate: false, // Don't create yet, show preview first
      });

      setGeneratedTemplate(result.template);
      setTemplateQuality(result.quality);
      setTemplateNeedsReview(result.needsReview);
      setTemplateReviewReasons(result.reviewReasons);
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {flowType === "template" ? "AI Model for Template Generation" : "AI Models for Upload Flow"}
            </CardTitle>
            <CardDescription>
              {flowType === "template"
                ? "Select the model used to generate templates from uploaded invoices. Models are loaded live from Gemini and OpenAI."
                : "Select models for extraction and template generation. Models are loaded live from Gemini and OpenAI."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid grid-cols-1 ${flowType === "invoice" ? "md:grid-cols-2" : ""} gap-4`}>
              {flowType === "invoice" && (
                <ModelSelector
                  label="Extraction model"
                  value={extractionTaskConfig}
                  models={aiModels}
                  loading={isAiModelsLoading}
                  disabled={!currentOrganization}
                  onChange={setExtractionTaskConfig}
                />
              )}
              <ModelSelector
                label="Template model"
                value={templateTaskConfig}
                models={aiModels}
                loading={isAiModelsLoading}
                disabled={!currentOrganization}
                onChange={setTemplateTaskConfig}
              />
            </div>
            {aiModelsData && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Gemini: {aiModelsData.providers.gemini.available ? `${aiModelsData.providers.gemini.count} models` : "Unavailable"}
                </Badge>
                <Badge variant="outline">
                  OpenAI: {aiModelsData.providers.openai.available ? `${aiModelsData.providers.openai.count} models` : "Unavailable"}
                </Badge>
              </div>
            )}
            {isAiModelsError && (
              <Alert>
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>Could not load models. You can retry.</span>
                  <Button variant="outline" size="sm" onClick={() => void refetchAiModels()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {flowType === "template"
                  ? "Task: template generation"
                  : "Tasks: extraction + template generation"}
              </Badge>
              <Badge variant="secondary">Applied per request only</Badge>
            </div>
          </CardContent>
        </Card>

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
            <span className="font-medium">{flowType === "template" ? "Analyze" : "Extract"}</span>
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

        {/* Preview/Generate Step (Template Flow: one-shot vision, no OCR step) */}
        {step === "preview" && flowType === "template" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Template Generation</CardTitle>
                <CardDescription>
                  We analyze your invoice visually in one AI pass and build a block-based template.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generateTemplateFromInvoiceFile.isPending ? (
                  <div className="flex items-center justify-center gap-3 py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Generating template from invoice layout...
                    </p>
                  </div>
                ) : generatedTemplate ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Template generated. Review and accept the preview.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Template generation failed. Please upload again or retry.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {generatedTemplate && (
              <TemplatePreviewDialog
                inline
                template={generatedTemplate}
                quality={templateQuality || undefined}
                needsReview={templateNeedsReview}
                reviewReasons={templateReviewReasons}
                extractedData={(editedExtractedData || (job?.extractedData as Record<string, InvoiceDataValue>) || {})}
                flowType={flowType}
                onAccept={handleAcceptTemplate}
                onEdit={handleEditTemplate}
              />
            )}
          </>
        )}

        {/* Preview/Generate Step (Invoice Flow: OCR/extraction path) */}
        {step === "preview" && flowType === "invoice" && job && job.status === "extracted" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Extracted Data</CardTitle>
                <CardDescription>
                  Review the extracted data and generate a template. You can edit both field names and values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.extractedData ? (
                  <ExtractionResultsPanel 
                    job={job}
                    flowType={flowType}
                    onGenerateTemplate={handleGenerateTemplate}
                    isGenerating={generateTemplateFromInvoiceFile.isPending}
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
                inline
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
