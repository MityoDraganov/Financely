import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, ExternalLink, RefreshCw, Loader2, History, RotateCcw, Eye, Image as ImageIcon, X, Copy, Check, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useGenerateSite, useRegenerateSite, useAddCustomDomain, useRestoreBrandSiteVersion, usePreviewBrandSiteVersion } from "@/hooks/service-hooks/use-brand-site";
import { useBrandSite, useBrandSitesByOrganization } from "@/hooks/repository-hooks/use-brand-site";
import { projectId } from "@/infrastructure/firebase";

export default function SiteBuilderPage() {
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [context, setContext] = useState("");
  const [contextImages, setContextImages] = useState<string[]>([]);
  const [previewingVersion, setPreviewingVersion] = useState<number | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const contextUploadRef = useRef<HTMLInputElement>(null);
  const contextFileUpload = useFileUpload();
  const generateSite = useGenerateSite();
  const regenerateSite = useRegenerateSite();
  const addCustomDomain = useAddCustomDomain();
  const restoreVersion = useRestoreBrandSiteVersion();
  const previewVersion = usePreviewBrandSiteVersion();
  const [currentBrandSiteId, setCurrentBrandSiteId] = useState<string | null>(null);
  const brandSite = useBrandSite(currentBrandSiteId);
  
  // Widget configuration state
  type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  
  const [widgetsEnabled, setWidgetsEnabled] = useState(false);
  const [contactFormConfig, setContactFormConfig] = useState<{
    enabled: boolean;
    title: string;
    description: string;
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
    displayMode: "floating" | "inline";
  }>({
    enabled: false,
    title: "Contact Us",
    description: "",
    submitButtonText: "Send Message",
    successMessage: "Thank you! We'll get back to you soon.",
    position: "bottom-right",
    displayMode: "floating",
  });
  const [invoiceRequestConfig, setInvoiceRequestConfig] = useState<{
    enabled: boolean;
    title: string;
    description: string;
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
  }>({
    enabled: false,
    title: "Request Invoice",
    description: "",
    submitButtonText: "Request Invoice",
    successMessage: "Invoice request submitted successfully!",
    position: "bottom-right",
  });
  const [quoteRequestConfig, setQuoteRequestConfig] = useState<{
    enabled: boolean;
    title: string;
    description: string;
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
  }>({
    enabled: false,
    title: "Request Quote",
    description: "",
    submitButtonText: "Request Quote",
    successMessage: "Quote request submitted successfully!",
    position: "bottom-right",
  });
  
  // Load existing brand sites for this organization
  const { data: brandSites = [] } = useBrandSitesByOrganization(organization?.id);
  // Set current brand site ID from existing sites on mount
  useEffect(() => {
    if (brandSites.length > 0 && !currentBrandSiteId) {
      // Use the most recent site (first in the list since it's ordered by createdAt desc)
      setCurrentBrandSiteId(brandSites[0].id);
    }
  }, [brandSites, currentBrandSiteId]);

  // Load context from brand site if it exists
  const prevBrandSiteIdRef = useRef<string | null>(null);
  const brandSiteId = brandSite?.data?.id ?? null;
  const brandSiteContext = (brandSite?.data as { context?: string; contextImages?: string[] })?.context;
  const brandSiteContextImages = (brandSite?.data as { context?: string; contextImages?: string[] })?.contextImages;
  
  useEffect(() => {
    if (!brandSiteId) {
      if (prevBrandSiteIdRef.current !== null) {
        prevBrandSiteIdRef.current = null;
        setContext("");
        setContextImages([]);
      }
      return;
    }
    
    // Only update if this is a different brand site
    if (prevBrandSiteIdRef.current === brandSiteId) {
      return;
    }
    
    prevBrandSiteIdRef.current = brandSiteId;
    setContext(brandSiteContext || "");
    setContextImages(brandSiteContextImages || []);
  }, [brandSiteId, brandSiteContext, brandSiteContextImages]);

  const handleContextUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/context-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await contextFileUpload.uploadFile(file, path);

    if (url) {
      setContextImages([...contextImages, url]);
      toast.success("Context image uploaded successfully");
    } else {
      toast.error(contextFileUpload.error || "Failed to upload image");
    }
  };

  const handleContextRemove = (index: number) => {
    const newImages = contextImages.filter((_, i) => i !== index);
    setContextImages(newImages);
  };

  // Load widget configuration from organization
  useEffect(() => {
    if (!organization?.settings?.widgets) return;
    
    const widgets = organization.settings.widgets;
    setWidgetsEnabled(widgets.enabled || false);
    
    if (widgets.contactForm) {
      setContactFormConfig({
        enabled: widgets.contactForm.enabled || false,
        title: widgets.contactForm.title || "Contact Us",
        description: widgets.contactForm.description || "",
        submitButtonText: widgets.contactForm.submitButtonText || "Send Message",
        successMessage: widgets.contactForm.successMessage || "Thank you! We'll get back to you soon.",
        position: widgets.contactForm.position || "bottom-right",
        displayMode: widgets.contactForm.displayMode || "floating",
      });
    }
    
    if (widgets.invoiceRequest) {
      setInvoiceRequestConfig({
        enabled: widgets.invoiceRequest.enabled || false,
        title: widgets.invoiceRequest.title || "Request Invoice",
        description: widgets.invoiceRequest.description || "",
        submitButtonText: widgets.invoiceRequest.submitButtonText || "Request Invoice",
        successMessage: widgets.invoiceRequest.successMessage || "Invoice request submitted successfully!",
        position: widgets.invoiceRequest.position || "bottom-right",
      });
    }
    
    if (widgets.quoteRequest) {
      setQuoteRequestConfig({
        enabled: widgets.quoteRequest.enabled || false,
        title: widgets.quoteRequest.title || "Request Quote",
        description: widgets.quoteRequest.description || "",
        submitButtonText: widgets.quoteRequest.submitButtonText || "Request Quote",
        successMessage: widgets.quoteRequest.successMessage || "Quote request submitted successfully!",
        position: widgets.quoteRequest.position || "bottom-right",
      });
    }
  }, [organization?.settings?.widgets]);

  // Save widget configuration
  const handleSaveWidgets = async () => {
    if (!organization) return;

    try {
      const existingSettings = organization.settings || {};
      
      // Build widgets object, only including enabled widgets (Firestore doesn't accept undefined)
      const widgets: {
        enabled: boolean;
        contactForm?: typeof contactFormConfig & { fields: Array<{ name: string; label: string; type: "text" | "email" | "tel" | "textarea"; required: boolean }> };
        invoiceRequest?: typeof invoiceRequestConfig;
        quoteRequest?: typeof quoteRequestConfig;
      } = {
        enabled: widgetsEnabled,
      };

      if (widgetsEnabled && contactFormConfig.enabled) {
        widgets.contactForm = {
          ...contactFormConfig,
          fields: [
            { name: "name", label: "Name", type: "text" as const, required: true },
            { name: "email", label: "Email", type: "email" as const, required: true },
            { name: "message", label: "Message", type: "textarea" as const, required: true },
          ],
        };
      }

      if (widgetsEnabled && invoiceRequestConfig.enabled) {
        widgets.invoiceRequest = invoiceRequestConfig;
      }

      if (widgetsEnabled && quoteRequestConfig.enabled) {
        widgets.quoteRequest = quoteRequestConfig;
      }
      
      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...existingSettings,
            widgets,
          },
        },
      });

      toast.success("Widget configuration saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save widget configuration");
    }
  };

  // Generate embed script
  const getEmbedScript = () => {
    if (!organization) return "";
    const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
    const widgetLoaderUrl = window.location.origin + "/widget-loader.js";
    return `<script src="${widgetLoaderUrl}" data-org-id="${organization.id}" data-api-url="${apiUrl}"></script>`;
  };

  const handleCopyScript = () => {
    const script = getEmbedScript();
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    toast.success("Embed script copied to clipboard");
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Site Builder</h1>
            <p className="text-muted-foreground">
              Generate a branded website automatically using AI. Your site will be hosted on a custom subdomain.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl">
        <Card className="shadow-sm border-gray-200/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              Site Generation
            </CardTitle>
            <CardDescription className="ml-11">
              Provide context and instructions to generate or regenerate your website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Context Section */}
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <Label>Context & Instructions (Optional)</Label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Provide additional context, tasks, or instructions for the AI site builder..."
                className="min-h-[100px]"
              />
              <div className="space-y-2">
                <Label className="text-sm">Context Images (Optional)</Label>
                <input
                  ref={contextUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleContextUpload(file);
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {contextImages.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Context ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-5 w-5 rounded-full bg-white shadow-sm hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleContextRemove(index)}
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  <div
                    onClick={() => contextUploadRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg w-20 h-20 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
                  >
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
                {contextFileUpload.isUploading && (
                  <p className="text-sm text-gray-500">
                    Uploading... {contextFileUpload.uploadProgress}%
                  </p>
                )}
                {contextFileUpload.error && (
                  <p className="text-sm text-red-600">{contextFileUpload.error}</p>
                )}
                <p className="text-xs text-gray-500">
                  These images are only used for AI context and are not saved to your brand gallery.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {/* Show Generate Website button only if no site exists */}
              {brandSites.length === 0 && (
                <Button
                  type="button"
                  onClick={() => {
                    if (!organization?.id) return;
                    generateSite.mutate(
                      {
                        organizationId: organization.id,
                        brandName: organization.settings?.branding?.companyName || organization.name,
                        tone: "professional",
                        context: context.trim() || undefined,
                        contextImages: contextImages.length > 0 ? contextImages : undefined,
                      },
                      {
                        onSuccess: (result) => {
                          setCurrentBrandSiteId(result.id);
                        },
                      }
                    );
                  }}
                  disabled={generateSite.isPending || !organization?.id}
                  className="w-full shadow-sm"
                >
                  {generateSite.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Website
                    </>
                  )}
                </Button>
              )}

              {/* Show existing site info and regenerate button if site exists */}
              {brandSites.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                        if (!brandSiteId) return;
                        regenerateSite.mutate({
                          brandSiteId,
                          context: context.trim() || undefined,
                          contextImages: contextImages.length > 0 ? contextImages : undefined,
                        });
                      }}
                      disabled={regenerateSite.isPending || (brandSite?.data || brandSites[0])?.status === "generating" || (brandSite?.data || brandSites[0])?.status === "deploying"}
                      className="flex-1 shadow-sm"
                    >
                      {regenerateSite.isPending || (brandSite?.data || brandSites[0])?.status === "generating" || (brandSite?.data || brandSites[0])?.status === "deploying" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate Site
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Status Display - Only show if site exists */}
                  {(brandSite?.data || brandSites[0]) && (
                <div className={`p-4 border rounded-lg ${
                  (brandSite?.data || brandSites[0])?.status === "success" 
                    ? "bg-green-50 border-green-200" 
                    : (brandSite?.data || brandSites[0])?.status === "failed"
                    ? "bg-red-50 border-red-200"
                    : "bg-blue-50 border-blue-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {((brandSite?.data || brandSites[0])?.status === "pending") && (
                        <>
                          <p className="text-sm font-medium text-blue-900">
                            Site generation queued...
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Waiting to start generation
                          </p>
                        </>
                      )}
                      {((brandSite?.data || brandSites[0])?.status === "generating") && (
                        <>
                          <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating site with AI...
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            This may take 1-2 minutes
                          </p>
                        </>
                      )}
                      {((brandSite?.data || brandSites[0])?.status === "deploying") && (
                        <>
                          <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Deploying site...
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Setting up hosting and DNS
                          </p>
                        </>
                      )}
                      {((brandSite?.data || brandSites[0])?.status === "success") && (brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl) && (
                        <>
                          <p className="text-sm font-medium text-green-900">
                            Site Generated Successfully!
                          </p>
                          <a
                            href={brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 mt-1"
                          >
                            {brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                      {((brandSite?.data || brandSites[0])?.status === "failed") && (
                        <>
                          <p className="text-sm font-medium text-red-900">
                            Site Generation Failed
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            {(brandSite?.data || brandSites[0])?.error || "Unknown error occurred"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                  )}
                </div>
              )}

              {generateSite.isError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    {generateSite.error instanceof Error
                      ? generateSite.error.message
                      : "Failed to start site generation. Please try again."}
                  </p>
                </div>
              )}

              {/* Version History - only show if site exists */}
              {brandSites.length > 0 && (brandSite?.data || brandSites[0]) && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Version History
                    </Label>
                    {(brandSite?.data || brandSites[0])?.metadata?.version && (
                      <span className="text-xs text-gray-500">
                        Current: v{(brandSite?.data || brandSites[0])?.metadata?.version}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {((brandSite?.data || brandSites[0])?.versions || []).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No previous versions available
                      </p>
                    ) : (
                      [...((brandSite?.data || brandSites[0])?.versions || [])]
                        .sort((a, b) => b.version - a.version)
                        .map((version) => (
                          <div
                            key={version.version}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Version {version.version}</span>
                                {version.version === (brandSite?.data || brandSites[0])?.metadata?.version && (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                              {version.description && (
                                <p className="text-xs text-gray-500 mt-1">{version.description}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {version.createdAt
                                  ? new Date(version.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Unknown date"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Preview button - show if preview URL exists or can be created */}
                              {version.previewUrl ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(version.previewUrl, "_blank")}
                                  className="h-8"
                                  title="Preview this version"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Preview
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                                    if (!brandSiteId) return;
                                    
                                    // Set loading state for this specific version
                                    setPreviewingVersion(version.version);
                                    
                                    // Create preview and open immediately
                                    try {
                                      const result = await previewVersion.mutateAsync({
                                        brandSiteId,
                                        version: version.version,
                                      });
                                      
                                      // Open the preview URL immediately after creation
                                      // Store the URL in a variable to ensure it's captured before any state updates
                                      const previewUrl = result?.previewUrl;
                                      if (previewUrl) {
                                        // Open immediately - must be in the same synchronous execution context
                                        // as the user click to avoid popup blockers
                                        const previewWindow = window.open(previewUrl, "_blank");
                                        if (!previewWindow) {
                                          // If popup was blocked, show a message
                                          toast.error("Popup blocked. Please allow popups for this site and try again.");
                                        } else {
                                          toast.success("Preview opened in new tab", {
                                            duration: 2000,
                                          });
                                        }
                                      }
                                    } catch (error) {
                                      // Error handling is done in the hook
                                      console.error("Failed to create preview:", error);
                                      setPreviewingVersion(null);
                                    } finally {
                                      // Clear loading state after a short delay to ensure UI updates
                                      setTimeout(() => {
                                        setPreviewingVersion(null);
                                      }, 500);
                                    }
                                  }}
                                  disabled={previewingVersion === version.version}
                                  className="h-8"
                                  title={previewingVersion === version.version ? "Creating preview..." : "Create preview for this version"}
                                >
                                  {previewingVersion === version.version ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Creating...
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3 w-3 mr-1" />
                                      Preview
                                    </>
                                  )}
                                </Button>
                              )}
                              {/* Live URL button - only show if this is the current version */}
                              {version.version === (brandSite?.data || brandSites[0])?.metadata?.version && (brandSite?.data || brandSites[0])?.deployedUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open((brandSite?.data || brandSites[0])?.deployedUrl, "_blank")}
                                  className="h-8"
                                  title="View live site"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Live
                                </Button>
                              )}
                              {/* Restore button - only show for non-current versions */}
                              {version.version !== (brandSite?.data || brandSites[0])?.metadata?.version && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                                    if (!brandSiteId) return;
                                    if (!confirm("Are you sure you want to restore this version? This will replace your current live site.")) {
                                      return;
                                    }
                                    restoreVersion.mutate({
                                      brandSiteId,
                                      version: version.version,
                                    });
                                  }}
                                  disabled={restoreVersion.isPending}
                                  className="h-8"
                                >
                                  {restoreVersion.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Restore
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Custom Domain section - only show if site exists */}
              {brandSites.length > 0 && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <Label>Custom Domain (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="example.com"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                        if (!brandSiteId || !customDomainInput) {
                          toast.error("Please enter a domain");
                          return;
                        }
                        addCustomDomain.mutate({
                          brandSiteId,
                          customDomain: customDomainInput,
                        });
                      }}
                      disabled={addCustomDomain.isPending || !customDomainInput}
                    >
                      {addCustomDomain.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Domain"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Connect your custom domain to your generated site. Make sure your domain DNS is configured correctly.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integration Widgets */}
        <Card className="shadow-sm border-gray-200/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Settings2 className="h-4 w-4 text-blue-600" />
              </div>
              Integration Widgets
            </CardTitle>
            <CardDescription className="ml-11">
              Create embeddable widgets for your website. Copy and paste the script into any website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable Widgets */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base font-semibold">Enable Widgets</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Allow widgets to be embedded on external websites
                </p>
              </div>
              <Switch
                checked={widgetsEnabled}
                onCheckedChange={setWidgetsEnabled}
              />
            </div>

            {widgetsEnabled && (
              <>
                {/* Contact Form Widget */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Contact Form Widget</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Allow visitors to submit contact information
                      </p>
                    </div>
                    <Switch
                      checked={contactFormConfig.enabled}
                      onCheckedChange={(enabled) =>
                        setContactFormConfig({ ...contactFormConfig, enabled })
                      }
                    />
                  </div>
                  {contactFormConfig.enabled && (
                    <div className="space-y-3 mt-4 pl-4 border-l-2">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={contactFormConfig.title}
                          onChange={(e) =>
                            setContactFormConfig({ ...contactFormConfig, title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Textarea
                          value={contactFormConfig.description}
                          onChange={(e) =>
                            setContactFormConfig({ ...contactFormConfig, description: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Display Mode</Label>
                        <Select
                          value={contactFormConfig.displayMode}
                          onValueChange={(value: "floating" | "inline") =>
                            setContactFormConfig({ ...contactFormConfig, displayMode: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="floating">Floating Button</SelectItem>
                            <SelectItem value="inline">Inline Form</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          {contactFormConfig.displayMode === "floating"
                            ? "Shows a floating button that opens a modal form"
                            : "Renders the form directly in the page where a placeholder element exists"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Button Text</Label>
                          <Input
                            value={contactFormConfig.submitButtonText}
                            onChange={(e) =>
                              setContactFormConfig({ ...contactFormConfig, submitButtonText: e.target.value })
                            }
                          />
                        </div>
                        {contactFormConfig.displayMode === "floating" && (
                          <div className="space-y-2">
                            <Label>Position</Label>
                            <Select
                              value={contactFormConfig.position}
                              onValueChange={(value: WidgetPosition) =>
                                setContactFormConfig({ ...contactFormConfig, position: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                <SelectItem value="top-right">Top Right</SelectItem>
                                <SelectItem value="top-left">Top Left</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {contactFormConfig.displayMode === "inline" && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Inline Form Usage:</strong> Add a placeholder element in your HTML where you want the form to appear:
                          </p>
                          <code className="text-xs text-blue-700 mt-2 block">
                            {`<div data-financely-widget="contactForm"></div>`}
                          </code>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Success Message</Label>
                        <Input
                          value={contactFormConfig.successMessage}
                          onChange={(e) =>
                            setContactFormConfig({ ...contactFormConfig, successMessage: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice Request Widget */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Invoice Request Widget</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Allow customers to request invoices
                      </p>
                    </div>
                    <Switch
                      checked={invoiceRequestConfig.enabled}
                      onCheckedChange={(enabled) =>
                        setInvoiceRequestConfig({ ...invoiceRequestConfig, enabled })
                      }
                    />
                  </div>
                  {invoiceRequestConfig.enabled && (
                    <div className="space-y-3 mt-4 pl-4 border-l-2">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={invoiceRequestConfig.title}
                          onChange={(e) =>
                            setInvoiceRequestConfig({ ...invoiceRequestConfig, title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Textarea
                          value={invoiceRequestConfig.description}
                          onChange={(e) =>
                            setInvoiceRequestConfig({ ...invoiceRequestConfig, description: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Button Text</Label>
                          <Input
                            value={invoiceRequestConfig.submitButtonText}
                            onChange={(e) =>
                              setInvoiceRequestConfig({ ...invoiceRequestConfig, submitButtonText: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Position</Label>
                          <Select
                            value={invoiceRequestConfig.position}
                            onValueChange={(value: WidgetPosition) =>
                              setInvoiceRequestConfig({ ...invoiceRequestConfig, position: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              <SelectItem value="top-right">Top Right</SelectItem>
                              <SelectItem value="top-left">Top Left</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Success Message</Label>
                        <Input
                          value={invoiceRequestConfig.successMessage}
                          onChange={(e) =>
                            setInvoiceRequestConfig({ ...invoiceRequestConfig, successMessage: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quote Request Widget */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Quote Request Widget</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Allow customers to request quotes
                      </p>
                    </div>
                    <Switch
                      checked={quoteRequestConfig.enabled}
                      onCheckedChange={(enabled) =>
                        setQuoteRequestConfig({ ...quoteRequestConfig, enabled })
                      }
                    />
                  </div>
                  {quoteRequestConfig.enabled && (
                    <div className="space-y-3 mt-4 pl-4 border-l-2">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={quoteRequestConfig.title}
                          onChange={(e) =>
                            setQuoteRequestConfig({ ...quoteRequestConfig, title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Textarea
                          value={quoteRequestConfig.description}
                          onChange={(e) =>
                            setQuoteRequestConfig({ ...quoteRequestConfig, description: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Button Text</Label>
                          <Input
                            value={quoteRequestConfig.submitButtonText}
                            onChange={(e) =>
                              setQuoteRequestConfig({ ...quoteRequestConfig, submitButtonText: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Position</Label>
                          <Select
                            value={quoteRequestConfig.position}
                            onValueChange={(value: WidgetPosition) =>
                              setQuoteRequestConfig({ ...quoteRequestConfig, position: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              <SelectItem value="top-right">Top Right</SelectItem>
                              <SelectItem value="top-left">Top Left</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Success Message</Label>
                        <Input
                          value={quoteRequestConfig.successMessage}
                          onChange={(e) =>
                            setQuoteRequestConfig({ ...quoteRequestConfig, successMessage: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveWidgets}
                  disabled={updateOrganization.isPending}
                  className="w-full"
                >
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Widget Configuration"
                  )}
                </Button>

                {/* Embed Script */}
                <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Embed Script</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyScript}
                    >
                      {copiedScript ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Script
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Copy this script and paste it into your website's HTML to embed the widgets.
                  </p>
                  <div className="relative">
                    <Textarea
                      value={getEmbedScript()}
                      readOnly
                      className="font-mono text-xs bg-white"
                      rows={3}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    The script will automatically load your widget configuration. No need to update it when you make changes.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

