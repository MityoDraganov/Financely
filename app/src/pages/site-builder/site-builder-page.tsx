import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, ExternalLink, RefreshCw, Loader2, History, RotateCcw, Eye, Image as ImageIcon, X, Copy, Check, Settings2, Plus, Trash2, Palette, Globe, FileText, Code } from "lucide-react";
import { useGenerateWidget } from "@/hooks/service-hooks/use-generate-widget";
import { useRestoreWidgetVersion } from "@/hooks/service-hooks/use-widget-versioning";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useGenerateSite, useRegenerateSite, useAddCustomDomain, useRestoreBrandSiteVersion, usePreviewBrandSiteVersion, useDeployManualSite } from "@/hooks/service-hooks/use-brand-site";
import { useBrandSite, useBrandSitesByOrganization } from "@/hooks/repository-hooks/use-brand-site";
import { projectId } from "@/infrastructure/firebase";
import { FileEditor } from "@/components/site-builder/file-editor";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { firebase } from "@/infrastructure/firebase";
import { WidgetPreview } from "@/components/widget-preview";

// Build default styling from organization branding
function buildDefaultStylingFromBranding(brandColors?: { primary?: string; secondary?: string; accent?: string }) {
  return {
    // Colors from organization branding
    primaryColor: brandColors?.primary || "#2563eb",
    secondaryColor: brandColors?.secondary || "#6b7280",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    borderColor: "#d1d5db",
    errorColor: "#ef4444",
    successColor: brandColors?.accent || "#10b981",
    // Typography
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: "400",
    // Spacing
    padding: "12px",
    gap: "16px",
    borderRadius: "8px",
    // Button styling
    buttonPadding: "12px 24px",
    buttonBorderRadius: "8px",
    buttonFontWeight: "600",
    // Modal/Container styling
    modalBackdropOpacity: "0.5",
    modalBorderRadius: "12px",
    modalMaxWidth: "500px",
    // Shadow
    shadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  };
}

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
  const deployManualSite = useDeployManualSite();
  const [currentBrandSiteId, setCurrentBrandSiteId] = useState<string | null>(null);
  const brandSite = useBrandSite(currentBrandSiteId);
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");
  
  // AI Widget Generation
  const generateWidget = useGenerateWidget();
  const [aiWidgetDialogOpen, setAiWidgetDialogOpen] = useState(false);
  const [aiWidgetType, setAiWidgetType] = useState<"contactForm" | "invoiceRequest" | "quoteRequest">("contactForm");
  const [aiWidgetStyle, setAiWidgetStyle] = useState<"modern" | "classic" | "minimal" | "professional" | "bold" | "elegant">("modern");
  const [aiWidgetContext, setAiWidgetContext] = useState("");
  
  // Widget Versioning
  const restoreWidgetVersion = useRestoreWidgetVersion();
  
  // Widget Preview
  const [previewWidgetDialogOpen, setPreviewWidgetDialogOpen] = useState(false);
  const [previewWidgetVersion, setPreviewWidgetVersion] = useState<{
    version: number;
    widgets: Record<string, unknown>;
  } | null>(null);
  
  // Widget configuration state
  type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  
  const [widgetsEnabled, setWidgetsEnabled] = useState(false);

  // Widget-specific styling state (initialized with branding defaults)
  const [contactFormStyling, setContactFormStyling] = useState(() => buildDefaultStylingFromBranding());
  const [invoiceRequestStyling, setInvoiceRequestStyling] = useState(() => buildDefaultStylingFromBranding());
  const [quoteRequestStyling, setQuoteRequestStyling] = useState(() => buildDefaultStylingFromBranding());
  
  // Update styling defaults when organization branding changes (if no widget-specific styling exists)
  useEffect(() => {
    if (!organization?.settings?.brandColors) return;
    
    const brandingDefaults = buildDefaultStylingFromBranding(organization.settings.brandColors);
    const widgets = organization.settings?.widgets;
    
    // Only update if widget config doesn't exist or doesn't have styling
    if (!widgets?.contactForm?.styling) {
      setContactFormStyling(brandingDefaults);
    }
    if (!widgets?.invoiceRequest?.styling) {
      setInvoiceRequestStyling(brandingDefaults);
    }
    if (!widgets?.quoteRequest?.styling) {
      setQuoteRequestStyling(brandingDefaults);
    }
  }, [organization?.settings?.brandColors, organization?.settings?.widgets]);

  // Widget-specific localization state
  const [contactFormLocalization, setContactFormLocalization] = useState({
    language: "en",
    translations: {} as Record<string, string>,
  });
  const [invoiceRequestLocalization, setInvoiceRequestLocalization] = useState({
    language: "en",
    translations: {} as Record<string, string>,
  });
  const [quoteRequestLocalization, setQuoteRequestLocalization] = useState({
    language: "en",
    translations: {} as Record<string, string>,
  });

  // Built-in fields state
  const [builtInFields, setBuiltInFields] = useState({
    name: { enabled: true, required: true, label: "Name" },
    email: { enabled: true, required: true, label: "Email" },
    phone: { enabled: false, required: false, label: "Phone" },
    company: { enabled: false, required: false, label: "Company" },
    message: { enabled: true, required: false, label: "Message" },
  });

  // Custom fields state
  const [customFields, setCustomFields] = useState<Array<{
    id: string;
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
    required: boolean;
    placeholder?: string;
    options?: string[];
    validation?: { min?: number; max?: number; pattern?: string };
    order: number;
  }>>([]);

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
    const brandColors = organization.settings.brandColors;
    const brandingDefaults = buildDefaultStylingFromBranding(brandColors);
    setWidgetsEnabled(widgets.enabled || false);
    
    // Load contact form widget configuration
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
      
      // Load contact form styling (merge with branding defaults)
      if (widgets.contactForm.styling) {
        setContactFormStyling({
          ...brandingDefaults,
          ...widgets.contactForm.styling,
        });
      } else {
        setContactFormStyling(brandingDefaults);
      }
      
      // Load contact form localization
      if (widgets.contactForm.localization) {
        setContactFormLocalization({
          language: widgets.contactForm.localization.language || "en",
          translations: widgets.contactForm.localization.translations || {},
        });
      }
      
      // Load built-in fields
      if (widgets.contactForm.builtInFields) {
        setBuiltInFields({
          name: widgets.contactForm.builtInFields.name || { enabled: true, required: true, label: "Name" },
          email: widgets.contactForm.builtInFields.email || { enabled: true, required: true, label: "Email" },
          phone: widgets.contactForm.builtInFields.phone || { enabled: false, required: false, label: "Phone" },
          company: widgets.contactForm.builtInFields.company || { enabled: false, required: false, label: "Company" },
          message: widgets.contactForm.builtInFields.message || { enabled: true, required: false, label: "Message" },
        });
      }
      
      // Load custom fields
      if (widgets.contactForm.customFields) {
        setCustomFields(widgets.contactForm.customFields);
      }
    }
    
    // Load invoice request widget configuration
    if (widgets.invoiceRequest) {
      setInvoiceRequestConfig({
        enabled: widgets.invoiceRequest.enabled || false,
        title: widgets.invoiceRequest.title || "Request Invoice",
        description: widgets.invoiceRequest.description || "",
        submitButtonText: widgets.invoiceRequest.submitButtonText || "Request Invoice",
        successMessage: widgets.invoiceRequest.successMessage || "Invoice request submitted successfully!",
        position: widgets.invoiceRequest.position || "bottom-right",
      });
      
      // Load invoice request styling (merge with branding defaults)
      if (widgets.invoiceRequest.styling) {
        setInvoiceRequestStyling({
          ...brandingDefaults,
          ...widgets.invoiceRequest.styling,
        });
      } else {
        setInvoiceRequestStyling(brandingDefaults);
      }
      
      // Load invoice request localization
      if (widgets.invoiceRequest.localization) {
        setInvoiceRequestLocalization({
          language: widgets.invoiceRequest.localization.language || "en",
          translations: widgets.invoiceRequest.localization.translations || {},
        });
      }
    }
    
    // Load quote request widget configuration
    if (widgets.quoteRequest) {
      setQuoteRequestConfig({
        enabled: widgets.quoteRequest.enabled || false,
        title: widgets.quoteRequest.title || "Request Quote",
        description: widgets.quoteRequest.description || "",
        submitButtonText: widgets.quoteRequest.submitButtonText || "Request Quote",
        successMessage: widgets.quoteRequest.successMessage || "Quote request submitted successfully!",
        position: widgets.quoteRequest.position || "bottom-right",
      });
      
      // Load quote request styling (merge with branding defaults)
      if (widgets.quoteRequest.styling) {
        setQuoteRequestStyling({
          ...brandingDefaults,
          ...widgets.quoteRequest.styling,
        });
      } else {
        setQuoteRequestStyling(brandingDefaults);
      }
      
      // Load quote request localization
      if (widgets.quoteRequest.localization) {
        setQuoteRequestLocalization({
          language: widgets.quoteRequest.localization.language || "en",
          translations: widgets.quoteRequest.localization.translations || {},
        });
      }
    }
  }, [organization?.settings?.widgets, organization?.settings?.brandColors]);

  // Save widget configuration
  const handleSaveWidgets = async () => {
    if (!organization) return;

    try {
      const existingSettings = organization.settings || {};
      const existingWidgets = existingSettings.widgets;
      
      // Build widgets object, only including enabled widgets (Firestore doesn't accept undefined)
      const widgets: {
        enabled: boolean;
        metadata?: { version: number; lastSavedAt?: string };
        versions?: Array<{
          version: number;
          widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
          widgets: Record<string, unknown>;
          createdAt: string;
          description?: string;
        }>;
        contactForm?: {
          enabled: boolean;
          title: string;
          description?: string;
          styling?: typeof contactFormStyling;
          localization?: typeof contactFormLocalization;
          builtInFields?: typeof builtInFields;
          customFields: typeof customFields;
          submitButtonText: string;
          successMessage: string;
          position: WidgetPosition;
          displayMode: "floating" | "inline";
        };
        invoiceRequest?: {
          enabled: boolean;
          title: string;
          description?: string;
          styling?: typeof invoiceRequestStyling;
          localization?: typeof invoiceRequestLocalization;
          submitButtonText: string;
          successMessage: string;
          position: WidgetPosition;
        };
        quoteRequest?: {
          enabled: boolean;
          title: string;
          description?: string;
          styling?: typeof quoteRequestStyling;
          localization?: typeof quoteRequestLocalization;
          submitButtonText: string;
          successMessage: string;
          position: WidgetPosition;
        };
      } = {
        enabled: widgetsEnabled,
      };

      if (widgetsEnabled && contactFormConfig.enabled) {
        widgets.contactForm = {
          ...contactFormConfig,
          styling: contactFormStyling,
          localization: contactFormLocalization,
          builtInFields: builtInFields,
          customFields: customFields.length > 0 ? customFields : [],
        };
      }

      if (widgetsEnabled && invoiceRequestConfig.enabled) {
        widgets.invoiceRequest = {
          ...invoiceRequestConfig,
          styling: invoiceRequestStyling,
          localization: invoiceRequestLocalization,
        };
      }

      if (widgetsEnabled && quoteRequestConfig.enabled) {
        widgets.quoteRequest = {
          ...quoteRequestConfig,
          styling: quoteRequestStyling,
          localization: quoteRequestLocalization,
        };
      }

      // Save current version to history before updating (if widgets exist)
      const currentVersion = existingWidgets?.metadata?.version || 1;
      const existingVersions: Array<{
        version: number;
        widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
        widgets: Record<string, unknown>;
        createdAt: string;
        description?: string;
      }> = (existingWidgets?.versions || []).filter((v): v is {
        version: number;
        widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
        widgets: Record<string, unknown>;
        createdAt: string;
        description?: string;
      } => v.widgets != null);
      
      if (existingWidgets?.enabled) {
        widgets.versions = [
          ...existingVersions,
          {
            version: currentVersion,
            widgetType: "all",
            widgets: {
              enabled: existingWidgets.enabled,
              contactForm: existingWidgets.contactForm,
              invoiceRequest: existingWidgets.invoiceRequest,
              quoteRequest: existingWidgets.quoteRequest,
            },
            createdAt: new Date().toISOString(),
            description: "Version before save",
          },
        ];
        widgets.metadata = {
          version: currentVersion + 1,
          lastSavedAt: new Date().toISOString(),
        };
      } else {
        widgets.metadata = {
          version: 1,
          lastSavedAt: new Date().toISOString(),
        };
        widgets.versions = [];
      }
      
      // Ensure versions is always an array (not undefined)
      const widgetsToSave = {
        ...widgets,
        versions: widgets.versions || [],
      };
      
      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...existingSettings,
            widgets: widgetsToSave,
          },
        },
      });

      toast.success("Widget configuration saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save widget configuration");
    }
  };

  // Add custom field
  const handleAddCustomField = () => {
    const newField = {
      id: `custom-${Date.now()}`,
      name: `field_${customFields.length + 1}`,
      label: "New Field",
      type: "text" as const,
      required: false,
      order: customFields.length,
    };
    setCustomFields([...customFields, newField]);
  };

  // Remove custom field
  const handleRemoveCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  // Update custom field
  const handleUpdateCustomField = (id: string, updates: Partial<typeof customFields[0]>) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, ...updates } : f));
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

      <div className="max-w-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ai" | "manual")} className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Generation
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Manual Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-6">
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
          </TabsContent>

          <TabsContent value="manual" className="space-y-6">
            {brandSites.length === 0 ? (
              <Card className="shadow-sm border-gray-200/50">
                <CardContent className="p-8 text-center">
                  <Code className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No Site Created Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Create a site using AI generation first, or start with a blank template.
                  </p>
                  <Button
                    onClick={() => {
                      if (!organization?.id) return;
                      // Create a blank site with minimal HTML
                      const blankHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${organization.settings?.branding?.companyName || organization.name}</title>
</head>
<body>
  <h1>Welcome</h1>
  <p>Start editing your site files!</p>
</body>
</html>`;
                      generateSite.mutate(
                        {
                          organizationId: organization.id,
                          brandName: organization.settings?.branding?.companyName || organization.name,
                          tone: "professional",
                        },
                        {
                          onSuccess: async (result) => {
                            setCurrentBrandSiteId(result.id);
                            // Update with blank HTML and files
                            const db = getFirestore(firebase.app);
                            await updateDoc(doc(db, "brandSites", result.id), {
                              html: blankHtml,
                              files: {
                                "index.html": blankHtml,
                              },
                            });
                            toast.success("Blank site created! Start editing in the file editor.");
                            setActiveTab("manual");
                          },
                        }
                      );
                    }}
                    disabled={generateSite.isPending || !organization?.id}
                  >
                    {generateSite.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Blank Site
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm border-gray-200/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Code className="h-4 w-4 text-blue-600" />
                    </div>
                    Code Editor
                  </CardTitle>
                  <CardDescription className="ml-11">
                    Edit your site files directly. Changes are saved automatically when you deploy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                                Site deployment queued...
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                Waiting to start deployment
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
                                Site Deployed Successfully!
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
                                Site Deployment Failed
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

                  <FileEditor
                    files={brandSite?.data?.files || (brandSite?.data?.html ? { "index.html": brandSite.data.html } : {})}
                    onSave={async (files) => {
                      if (!currentBrandSiteId) return;
                      const db = getFirestore(firebase.app);
                      await updateDoc(doc(db, "brandSites", currentBrandSiteId), {
                        files,
                        html: files["index.html"] || files["/index.html"] || brandSite?.data?.html || "",
                      });
                    }}
                    onDeploy={async (files) => {
                      if (!currentBrandSiteId || !organization?.id) return;
                      await deployManualSite.mutateAsync({
                        brandSiteId: currentBrandSiteId,
                        files: Object.entries(files).map(([path, content]) => ({
                          path,
                          content,
                        })),
                        versionMessage: "Manual deployment from code editor",
                        includeWidgets: organization.settings?.widgets?.enabled || false,
                      });
                    }}
                    organizationId={organization?.id || ""}
                    projectId={projectId || ""}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-base font-semibold">Contact Form Widget</Label>
                        {contactFormConfig.enabled && (
                          <Button
                            type="button"
                            onClick={() => {
                              setAiWidgetType("contactForm");
                              setAiWidgetDialogOpen(true);
                            }}
                            className="bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] h-8 px-3 text-xs"
                            size="sm"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                            AI Builder
                          </Button>
                        )}
                      </div>
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
                    <div className="space-y-4 mt-4 pl-4 border-l-2">
                      {/* Basic Configuration */}
                      <div className="space-y-3">
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

                      {/* Widget-Specific Styling */}
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="contactForm-styling">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            <span>Styling & Appearance</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <ColorPicker
                                label="Primary Color"
                                value={contactFormStyling.primaryColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, primaryColor: color })}
                              />
                              <ColorPicker
                                label="Secondary Color"
                                value={contactFormStyling.secondaryColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, secondaryColor: color })}
                              />
                              <ColorPicker
                                label="Background Color"
                                value={contactFormStyling.backgroundColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, backgroundColor: color })}
                              />
                              <ColorPicker
                                label="Text Color"
                                value={contactFormStyling.textColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, textColor: color })}
                              />
                              <ColorPicker
                                label="Border Color"
                                value={contactFormStyling.borderColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, borderColor: color })}
                              />
                              <ColorPicker
                                label="Error Color"
                                value={contactFormStyling.errorColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, errorColor: color })}
                              />
                              <ColorPicker
                                label="Success Color"
                                value={contactFormStyling.successColor}
                                onChange={(color) => setContactFormStyling({ ...contactFormStyling, successColor: color })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Font Family</Label>
                                <Input
                                  value={contactFormStyling.fontFamily}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, fontFamily: e.target.value })}
                                  placeholder="Arial, sans-serif"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Size</Label>
                                <Input
                                  value={contactFormStyling.fontSize}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, fontSize: e.target.value })}
                                  placeholder="14px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Weight</Label>
                                <Select
                                  value={contactFormStyling.fontWeight}
                                  onValueChange={(value) => setContactFormStyling({ ...contactFormStyling, fontWeight: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="300">Light (300)</SelectItem>
                                    <SelectItem value="400">Normal (400)</SelectItem>
                                    <SelectItem value="500">Medium (500)</SelectItem>
                                    <SelectItem value="600">Semi-bold (600)</SelectItem>
                                    <SelectItem value="700">Bold (700)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Padding</Label>
                                <Input
                                  value={contactFormStyling.padding}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, padding: e.target.value })}
                                  placeholder="12px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Gap</Label>
                                <Input
                                  value={contactFormStyling.gap}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, gap: e.target.value })}
                                  placeholder="16px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Border Radius</Label>
                                <Input
                                  value={contactFormStyling.borderRadius}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, borderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Padding</Label>
                                <Input
                                  value={contactFormStyling.buttonPadding}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, buttonPadding: e.target.value })}
                                  placeholder="12px 24px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Border Radius</Label>
                                <Input
                                  value={contactFormStyling.buttonBorderRadius}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, buttonBorderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Modal Max Width</Label>
                                <Input
                                  value={contactFormStyling.modalMaxWidth}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, modalMaxWidth: e.target.value })}
                                  placeholder="500px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Shadow</Label>
                                <Input
                                  value={contactFormStyling.shadow}
                                  onChange={(e) => setContactFormStyling({ ...contactFormStyling, shadow: e.target.value })}
                                  placeholder="0 4px 12px rgba(0, 0, 0, 0.15)"
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Widget-Specific Localization */}
                        <AccordionItem value="contactForm-localization">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>Localization & Translations</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Default Language</Label>
                              <Select
                                value={contactFormLocalization.language}
                                onValueChange={(value) => setContactFormLocalization({ ...contactFormLocalization, language: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="es">Spanish</SelectItem>
                                  <SelectItem value="fr">French</SelectItem>
                                  <SelectItem value="de">German</SelectItem>
                                  <SelectItem value="it">Italian</SelectItem>
                                  <SelectItem value="pt">Portuguese</SelectItem>
                                  <SelectItem value="ru">Russian</SelectItem>
                                  <SelectItem value="zh">Chinese</SelectItem>
                                  <SelectItem value="ja">Japanese</SelectItem>
                                  <SelectItem value="ko">Korean</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Custom Translations</Label>
                              <p className="text-xs text-gray-500 mb-2">
                                Add custom translations for widget text. Use keys like "contactUs", "sendMessage", etc.
                              </p>
                              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                                {Object.entries(contactFormLocalization.translations).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <Input
                                      value={key}
                                      onChange={(e) => {
                                        const newTranslations = { ...contactFormLocalization.translations };
                                        delete newTranslations[key];
                                        newTranslations[e.target.value] = value;
                                        setContactFormLocalization({ ...contactFormLocalization, translations: newTranslations });
                                      }}
                                      placeholder="Translation key"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={value}
                                      onChange={(e) => {
                                        setContactFormLocalization({
                                          ...contactFormLocalization,
                                          translations: { ...contactFormLocalization.translations, [key]: e.target.value },
                                        });
                                      }}
                                      placeholder="Translated text"
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newTranslations = { ...contactFormLocalization.translations };
                                        delete newTranslations[key];
                                        setContactFormLocalization({ ...contactFormLocalization, translations: newTranslations });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newKey = `key_${Object.keys(contactFormLocalization.translations).length + 1}`;
                                    setContactFormLocalization({
                                      ...contactFormLocalization,
                                      translations: { ...contactFormLocalization.translations, [newKey]: "" },
                                    });
                                  }}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Translation
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Field Configuration - Only for Contact Form */}
                        <AccordionItem value="contactForm-fields">
                          <AccordionTrigger className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>Field Configuration</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            {/* Built-in Fields */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Built-in Fields</Label>
                              {Object.entries(builtInFields).map(([fieldKey, fieldConfig]) => (
                                <div key={fieldKey} className="p-3 border rounded-lg space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={fieldConfig.enabled}
                                        onCheckedChange={(checked) =>
                                          setBuiltInFields({
                                            ...builtInFields,
                                            [fieldKey]: { ...fieldConfig, enabled: checked as boolean },
                                          })
                                        }
                                      />
                                      <Label className="font-medium capitalize">{fieldKey}</Label>
                                    </div>
                                  </div>
                                  {fieldConfig.enabled && (
                                    <div className="grid grid-cols-2 gap-3 pl-6">
                                      <div className="space-y-2">
                                        <Label>Label</Label>
                                        <Input
                                          value={fieldConfig.label}
                                          onChange={(e) =>
                                            setBuiltInFields({
                                              ...builtInFields,
                                              [fieldKey]: { ...fieldConfig, label: e.target.value },
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 pt-6">
                                        <Checkbox
                                          checked={fieldConfig.required}
                                          onCheckedChange={(checked) =>
                                            setBuiltInFields({
                                              ...builtInFields,
                                              [fieldKey]: { ...fieldConfig, required: checked as boolean },
                                            })
                                          }
                                        />
                                        <Label>Required</Label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Custom Fields */}
                            <div className="space-y-3 border-t pt-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Custom Fields</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleAddCustomField}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Custom Field
                                </Button>
                              </div>
                              {customFields.map((field) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label>Field Name (ID)</Label>
                                      <Input
                                        value={field.name}
                                        onChange={(e) => handleUpdateCustomField(field.id, { name: e.target.value })}
                                        placeholder="field_name"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Field Label</Label>
                                      <Input
                                        value={field.label}
                                        onChange={(e) => handleUpdateCustomField(field.id, { label: e.target.value })}
                                        placeholder="Field Label"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label>Field Type</Label>
                                      <Select
                                        value={field.type}
                                        onValueChange={(value) => handleUpdateCustomField(field.id, { type: value as typeof field.type })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="text">Text</SelectItem>
                                          <SelectItem value="email">Email</SelectItem>
                                          <SelectItem value="tel">Phone</SelectItem>
                                          <SelectItem value="textarea">Textarea</SelectItem>
                                          <SelectItem value="number">Number</SelectItem>
                                          <SelectItem value="select">Select</SelectItem>
                                          <SelectItem value="checkbox">Checkbox</SelectItem>
                                          <SelectItem value="date">Date</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
                                      <Checkbox
                                        checked={field.required}
                                        onCheckedChange={(checked) => handleUpdateCustomField(field.id, { required: checked as boolean })}
                                      />
                                      <Label>Required</Label>
                                    </div>
                                  </div>
                                  {field.type === "select" && (
                                    <div className="space-y-2">
                                      <Label>Options (one per line)</Label>
                                      <Textarea
                                        value={field.options?.join("\n") || ""}
                                        onChange={(e) =>
                                          handleUpdateCustomField(field.id, {
                                            options: e.target.value.split("\n").filter((o) => o.trim()),
                                          })
                                        }
                                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                                        rows={3}
                                      />
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <Label>Placeholder (Optional)</Label>
                                    <Input
                                      value={field.placeholder || ""}
                                      onChange={(e) => handleUpdateCustomField(field.id, { placeholder: e.target.value })}
                                      placeholder="Enter placeholder text"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveCustomField(field.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Field
                                  </Button>
                                </div>
                              ))}
                              {customFields.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  No custom fields added. Click "Add Custom Field" to create one.
                                </p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                </div>

                {/* Invoice Request Widget */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-base font-semibold">Invoice Request Widget</Label>
                        {invoiceRequestConfig.enabled && (
                          <Button
                            type="button"
                            onClick={() => {
                              setAiWidgetType("invoiceRequest");
                              setAiWidgetDialogOpen(true);
                            }}
                            className="bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] h-8 px-3 text-xs"
                            size="sm"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                            AI Builder
                          </Button>
                        )}
                      </div>
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
                    <div className="space-y-4 mt-4 pl-4 border-l-2">
                      {/* Basic Configuration */}
                      <div className="space-y-3">
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

                      {/* Widget-Specific Styling & Localization */}
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="invoiceRequest-styling">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            <span>Styling & Appearance</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <ColorPicker
                                label="Primary Color"
                                value={invoiceRequestStyling.primaryColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, primaryColor: color })}
                              />
                              <ColorPicker
                                label="Secondary Color"
                                value={invoiceRequestStyling.secondaryColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, secondaryColor: color })}
                              />
                              <ColorPicker
                                label="Background Color"
                                value={invoiceRequestStyling.backgroundColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, backgroundColor: color })}
                              />
                              <ColorPicker
                                label="Text Color"
                                value={invoiceRequestStyling.textColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, textColor: color })}
                              />
                              <ColorPicker
                                label="Border Color"
                                value={invoiceRequestStyling.borderColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, borderColor: color })}
                              />
                              <ColorPicker
                                label="Error Color"
                                value={invoiceRequestStyling.errorColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, errorColor: color })}
                              />
                              <ColorPicker
                                label="Success Color"
                                value={invoiceRequestStyling.successColor}
                                onChange={(color) => setInvoiceRequestStyling({ ...invoiceRequestStyling, successColor: color })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Font Family</Label>
                                <Input
                                  value={invoiceRequestStyling.fontFamily}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, fontFamily: e.target.value })}
                                  placeholder="Arial, sans-serif"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Size</Label>
                                <Input
                                  value={invoiceRequestStyling.fontSize}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, fontSize: e.target.value })}
                                  placeholder="14px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Weight</Label>
                                <Select
                                  value={invoiceRequestStyling.fontWeight}
                                  onValueChange={(value) => setInvoiceRequestStyling({ ...invoiceRequestStyling, fontWeight: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="300">Light (300)</SelectItem>
                                    <SelectItem value="400">Normal (400)</SelectItem>
                                    <SelectItem value="500">Medium (500)</SelectItem>
                                    <SelectItem value="600">Semi-bold (600)</SelectItem>
                                    <SelectItem value="700">Bold (700)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Padding</Label>
                                <Input
                                  value={invoiceRequestStyling.padding}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, padding: e.target.value })}
                                  placeholder="12px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Gap</Label>
                                <Input
                                  value={invoiceRequestStyling.gap}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, gap: e.target.value })}
                                  placeholder="16px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Border Radius</Label>
                                <Input
                                  value={invoiceRequestStyling.borderRadius}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, borderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Padding</Label>
                                <Input
                                  value={invoiceRequestStyling.buttonPadding}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, buttonPadding: e.target.value })}
                                  placeholder="12px 24px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Border Radius</Label>
                                <Input
                                  value={invoiceRequestStyling.buttonBorderRadius}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, buttonBorderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Modal Max Width</Label>
                                <Input
                                  value={invoiceRequestStyling.modalMaxWidth}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, modalMaxWidth: e.target.value })}
                                  placeholder="500px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Shadow</Label>
                                <Input
                                  value={invoiceRequestStyling.shadow}
                                  onChange={(e) => setInvoiceRequestStyling({ ...invoiceRequestStyling, shadow: e.target.value })}
                                  placeholder="0 4px 12px rgba(0, 0, 0, 0.15)"
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="invoiceRequest-localization">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>Localization & Translations</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Default Language</Label>
                              <Select
                                value={invoiceRequestLocalization.language}
                                onValueChange={(value) => setInvoiceRequestLocalization({ ...invoiceRequestLocalization, language: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="es">Spanish</SelectItem>
                                  <SelectItem value="fr">French</SelectItem>
                                  <SelectItem value="de">German</SelectItem>
                                  <SelectItem value="it">Italian</SelectItem>
                                  <SelectItem value="pt">Portuguese</SelectItem>
                                  <SelectItem value="ru">Russian</SelectItem>
                                  <SelectItem value="zh">Chinese</SelectItem>
                                  <SelectItem value="ja">Japanese</SelectItem>
                                  <SelectItem value="ko">Korean</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Custom Translations</Label>
                              <p className="text-xs text-gray-500 mb-2">
                                Add custom translations for widget text. Use keys like "requestInvoice", "submitButton", etc.
                              </p>
                              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                                {Object.entries(invoiceRequestLocalization.translations).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <Input
                                      value={key}
                                      onChange={(e) => {
                                        const newTranslations = { ...invoiceRequestLocalization.translations };
                                        delete newTranslations[key];
                                        newTranslations[e.target.value] = value;
                                        setInvoiceRequestLocalization({ ...invoiceRequestLocalization, translations: newTranslations });
                                      }}
                                      placeholder="Translation key"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={value}
                                      onChange={(e) => {
                                        setInvoiceRequestLocalization({
                                          ...invoiceRequestLocalization,
                                          translations: { ...invoiceRequestLocalization.translations, [key]: e.target.value },
                                        });
                                      }}
                                      placeholder="Translated text"
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newTranslations = { ...invoiceRequestLocalization.translations };
                                        delete newTranslations[key];
                                        setInvoiceRequestLocalization({ ...invoiceRequestLocalization, translations: newTranslations });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newKey = `key_${Object.keys(invoiceRequestLocalization.translations).length + 1}`;
                                    setInvoiceRequestLocalization({
                                      ...invoiceRequestLocalization,
                                      translations: { ...invoiceRequestLocalization.translations, [newKey]: "" },
                                    });
                                  }}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Translation
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                </div>

                {/* Quote Request Widget */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Label className="text-base font-semibold">Quote Request Widget</Label>
                        {quoteRequestConfig.enabled && (
                          <Button
                            type="button"
                            onClick={() => {
                              setAiWidgetType("quoteRequest");
                              setAiWidgetDialogOpen(true);
                            }}
                            className="bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] h-8 px-3 text-xs"
                            size="sm"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                            AI Builder
                          </Button>
                        )}
                      </div>
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
                    <div className="space-y-4 mt-4 pl-4 border-l-2">
                      {/* Basic Configuration */}
                      <div className="space-y-3">
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

                      {/* Widget-Specific Styling & Localization */}
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="quoteRequest-styling">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            <span>Styling & Appearance</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <ColorPicker
                                label="Primary Color"
                                value={quoteRequestStyling.primaryColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, primaryColor: color })}
                              />
                              <ColorPicker
                                label="Secondary Color"
                                value={quoteRequestStyling.secondaryColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, secondaryColor: color })}
                              />
                              <ColorPicker
                                label="Background Color"
                                value={quoteRequestStyling.backgroundColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, backgroundColor: color })}
                              />
                              <ColorPicker
                                label="Text Color"
                                value={quoteRequestStyling.textColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, textColor: color })}
                              />
                              <ColorPicker
                                label="Border Color"
                                value={quoteRequestStyling.borderColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, borderColor: color })}
                              />
                              <ColorPicker
                                label="Error Color"
                                value={quoteRequestStyling.errorColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, errorColor: color })}
                              />
                              <ColorPicker
                                label="Success Color"
                                value={quoteRequestStyling.successColor}
                                onChange={(color) => setQuoteRequestStyling({ ...quoteRequestStyling, successColor: color })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Font Family</Label>
                                <Input
                                  value={quoteRequestStyling.fontFamily}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, fontFamily: e.target.value })}
                                  placeholder="Arial, sans-serif"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Size</Label>
                                <Input
                                  value={quoteRequestStyling.fontSize}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, fontSize: e.target.value })}
                                  placeholder="14px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Font Weight</Label>
                                <Select
                                  value={quoteRequestStyling.fontWeight}
                                  onValueChange={(value) => setQuoteRequestStyling({ ...quoteRequestStyling, fontWeight: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="300">Light (300)</SelectItem>
                                    <SelectItem value="400">Normal (400)</SelectItem>
                                    <SelectItem value="500">Medium (500)</SelectItem>
                                    <SelectItem value="600">Semi-bold (600)</SelectItem>
                                    <SelectItem value="700">Bold (700)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Padding</Label>
                                <Input
                                  value={quoteRequestStyling.padding}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, padding: e.target.value })}
                                  placeholder="12px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Gap</Label>
                                <Input
                                  value={quoteRequestStyling.gap}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, gap: e.target.value })}
                                  placeholder="16px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Border Radius</Label>
                                <Input
                                  value={quoteRequestStyling.borderRadius}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, borderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Padding</Label>
                                <Input
                                  value={quoteRequestStyling.buttonPadding}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, buttonPadding: e.target.value })}
                                  placeholder="12px 24px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Button Border Radius</Label>
                                <Input
                                  value={quoteRequestStyling.buttonBorderRadius}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, buttonBorderRadius: e.target.value })}
                                  placeholder="8px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Modal Max Width</Label>
                                <Input
                                  value={quoteRequestStyling.modalMaxWidth}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, modalMaxWidth: e.target.value })}
                                  placeholder="500px"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Shadow</Label>
                                <Input
                                  value={quoteRequestStyling.shadow}
                                  onChange={(e) => setQuoteRequestStyling({ ...quoteRequestStyling, shadow: e.target.value })}
                                  placeholder="0 4px 12px rgba(0, 0, 0, 0.15)"
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="quoteRequest-localization">
                          <AccordionTrigger className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>Localization & Translations</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Default Language</Label>
                              <Select
                                value={quoteRequestLocalization.language}
                                onValueChange={(value) => setQuoteRequestLocalization({ ...quoteRequestLocalization, language: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="es">Spanish</SelectItem>
                                  <SelectItem value="fr">French</SelectItem>
                                  <SelectItem value="de">German</SelectItem>
                                  <SelectItem value="it">Italian</SelectItem>
                                  <SelectItem value="pt">Portuguese</SelectItem>
                                  <SelectItem value="ru">Russian</SelectItem>
                                  <SelectItem value="zh">Chinese</SelectItem>
                                  <SelectItem value="ja">Japanese</SelectItem>
                                  <SelectItem value="ko">Korean</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Custom Translations</Label>
                              <p className="text-xs text-gray-500 mb-2">
                                Add custom translations for widget text. Use keys like "requestQuote", "submitButton", etc.
                              </p>
                              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                                {Object.entries(quoteRequestLocalization.translations).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <Input
                                      value={key}
                                      onChange={(e) => {
                                        const newTranslations = { ...quoteRequestLocalization.translations };
                                        delete newTranslations[key];
                                        newTranslations[e.target.value] = value;
                                        setQuoteRequestLocalization({ ...quoteRequestLocalization, translations: newTranslations });
                                      }}
                                      placeholder="Translation key"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={value}
                                      onChange={(e) => {
                                        setQuoteRequestLocalization({
                                          ...quoteRequestLocalization,
                                          translations: { ...quoteRequestLocalization.translations, [key]: e.target.value },
                                        });
                                      }}
                                      placeholder="Translated text"
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newTranslations = { ...quoteRequestLocalization.translations };
                                        delete newTranslations[key];
                                        setQuoteRequestLocalization({ ...quoteRequestLocalization, translations: newTranslations });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newKey = `key_${Object.keys(quoteRequestLocalization.translations).length + 1}`;
                                    setQuoteRequestLocalization({
                                      ...quoteRequestLocalization,
                                      translations: { ...quoteRequestLocalization.translations, [newKey]: "" },
                                    });
                                  }}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Translation
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                </div>

                {/* Save Button and Version History */}
                <div className="space-y-3">
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

                  {/* Version History */}
                  {organization?.settings?.widgets?.versions && organization.settings.widgets.versions.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          <History className="h-4 w-4" />
                          Version History
                        </Label>
                        {organization.settings.widgets.metadata?.version && (
                          <span className="text-xs text-muted-foreground">
                            Current: v{organization.settings.widgets.metadata.version}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...organization.settings.widgets.versions]
                          .sort((a, b) => b.version - a.version)
                          .map((version) => (
                            <div
                              key={version.version}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Version {version.version}</span>
                                  {version.version === organization.settings?.widgets?.metadata?.version && (
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
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Unknown date"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPreviewWidgetVersion({
                                      version: version.version,
                                      widgets: version.widgets as Record<string, unknown>,
                                    });
                                    setPreviewWidgetDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Preview
                                </Button>
                                {version.version !== (organization.settings?.widgets?.metadata?.version ?? 0) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (!organization?.id) return;
                                      await restoreWidgetVersion.mutateAsync({
                                        organizationId: organization.id,
                                        version: version.version,
                                        widgetType: "all",
                                      });
                                    }}
                                    disabled={restoreWidgetVersion.isPending}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                    Restore
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

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

      {/* AI Widget Generation Dialog */}
      <Dialog open={aiWidgetDialogOpen} onOpenChange={setAiWidgetDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Generate Widget with AI
            </DialogTitle>
            <DialogDescription>
              Let AI create a beautiful, conversion-optimized widget design based on your organization's branding and preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <Select
                value={aiWidgetType}
                onValueChange={(value) => setAiWidgetType(value as typeof aiWidgetType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contactForm">Contact Form</SelectItem>
                  <SelectItem value="invoiceRequest">Invoice Request</SelectItem>
                  <SelectItem value="quoteRequest">Quote Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Design Style</Label>
              <Select
                value={aiWidgetStyle}
                onValueChange={(value) => setAiWidgetStyle(value as typeof aiWidgetStyle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern - Clean lines, contemporary colors</SelectItem>
                  <SelectItem value="classic">Classic - Traditional, conservative</SelectItem>
                  <SelectItem value="minimal">Minimal - Lots of white space, simple</SelectItem>
                  <SelectItem value="professional">Professional - Business-focused, trustworthy</SelectItem>
                  <SelectItem value="bold">Bold - Vibrant colors, eye-catching</SelectItem>
                  <SelectItem value="elegant">Elegant - Sophisticated, refined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Context (Optional)</Label>
              <Textarea
                value={aiWidgetContext}
                onChange={(e) => setAiWidgetContext(e.target.value)}
                placeholder="E.g., 'Make it friendly and approachable', 'Use a dark theme', 'Focus on mobile users'..."
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Provide any specific design preferences or requirements for the widget.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiWidgetDialogOpen(false)}
              disabled={generateWidget.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!organization?.id) {
                  toast.error("Organization not found");
                  return;
                }

                try {
                  const result = await generateWidget.mutateAsync({
                    organizationId: organization.id,
                    widgetType: aiWidgetType,
                    options: {
                      style: aiWidgetStyle,
                      context: aiWidgetContext.trim() || undefined,
                    },
                  });

                  // Apply generated styling and configuration
                  if (aiWidgetType === "contactForm") {
                    setContactFormStyling(result.styling);
                    setContactFormConfig({
                      ...contactFormConfig,
                      title: result.configuration.title,
                      description: result.configuration.description || "",
                      submitButtonText: result.configuration.submitButtonText,
                      successMessage: result.configuration.successMessage,
                    });
                    if (result.configuration.builtInFields) {
                      setBuiltInFields({
                        name: result.configuration.builtInFields.name || { enabled: true, required: true, label: "Name" },
                        email: result.configuration.builtInFields.email || { enabled: true, required: true, label: "Email" },
                        phone: result.configuration.builtInFields.phone || { enabled: false, required: false, label: "Phone" },
                        company: result.configuration.builtInFields.company || { enabled: false, required: false, label: "Company" },
                        message: result.configuration.builtInFields.message || { enabled: true, required: false, label: "Message" },
                      });
                    }
                    if (result.configuration.customFields && result.configuration.customFields.length > 0) {
                      setCustomFields(result.configuration.customFields);
                    }
                  } else if (aiWidgetType === "invoiceRequest") {
                    setInvoiceRequestStyling(result.styling);
                    setInvoiceRequestConfig({
                      ...invoiceRequestConfig,
                      title: result.configuration.title,
                      description: result.configuration.description || "",
                      submitButtonText: result.configuration.submitButtonText,
                      successMessage: result.configuration.successMessage,
                    });
                  } else if (aiWidgetType === "quoteRequest") {
                    setQuoteRequestStyling(result.styling);
                    setQuoteRequestConfig({
                      ...quoteRequestConfig,
                      title: result.configuration.title,
                      description: result.configuration.description || "",
                      submitButtonText: result.configuration.submitButtonText,
                      successMessage: result.configuration.successMessage,
                    });
                  }

                  toast.success("Widget design generated successfully!");
                  setAiWidgetDialogOpen(false);
                  setAiWidgetContext("");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(`Failed to generate widget: ${message}`);
                }
              }}
              disabled={generateWidget.isPending || !organization?.id}
            >
              {generateWidget.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Widget
                </>
              )}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Widget Version Preview Dialog */}
        <Dialog open={previewWidgetDialogOpen} onOpenChange={setPreviewWidgetDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                Preview Widget Version {previewWidgetVersion?.version}
              </DialogTitle>
              <DialogDescription>
                This is a preview of how the widgets looked in version {previewWidgetVersion?.version}. This preview is read-only.
              </DialogDescription>
            </DialogHeader>
            {previewWidgetVersion && (
              <div className="space-y-6 py-4">
                {/* Contact Form Preview */}
                {Boolean(previewWidgetVersion.widgets.contactForm && typeof previewWidgetVersion.widgets.contactForm === "object") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Contact Form Widget</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 border rounded-lg bg-gray-50">
                        <WidgetPreview
                          widgetType="contactForm"
                          config={{
                            title: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.title as string) || "Contact Us",
                            description: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.description as string) || undefined,
                            submitButtonText: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.submitButtonText as string) || "Submit",
                            successMessage: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.successMessage as string) || "Thank you!",
                            builtInFields: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.builtInFields as Record<string, unknown>) || undefined,
                            customFields: ((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.customFields as Array<{
                              id: string;
                              name: string;
                              label: string;
                              type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
                              required: boolean;
                              placeholder?: string;
                              options?: string[];
                              order: number;
                            }>) || undefined,
                          }}
                          styling={((previewWidgetVersion.widgets.contactForm as Record<string, unknown>)?.styling || {}) as Partial<{
                            primaryColor: string;
                            secondaryColor: string;
                            backgroundColor: string;
                            textColor: string;
                            borderColor: string;
                            errorColor: string;
                            successColor: string;
                            fontFamily: string;
                            fontSize: string;
                            fontWeight: string;
                            padding: string;
                            gap: string;
                            borderRadius: string;
                            buttonPadding: string;
                            buttonBorderRadius: string;
                            buttonFontWeight: string;
                            modalBackdropOpacity: string;
                            modalBorderRadius: string;
                            modalMaxWidth: string;
                            shadow: string;
                          }>}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Invoice Request Preview */}
                {Boolean(previewWidgetVersion.widgets.invoiceRequest && typeof previewWidgetVersion.widgets.invoiceRequest === "object") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Invoice Request Widget</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 border rounded-lg bg-gray-50">
                        <WidgetPreview
                          widgetType="invoiceRequest"
                          config={{
                            title: ((previewWidgetVersion.widgets.invoiceRequest as Record<string, unknown>)?.title as string) || "Request Invoice",
                            description: ((previewWidgetVersion.widgets.invoiceRequest as Record<string, unknown>)?.description as string) || undefined,
                            submitButtonText: ((previewWidgetVersion.widgets.invoiceRequest as Record<string, unknown>)?.submitButtonText as string) || "Submit",
                            successMessage: ((previewWidgetVersion.widgets.invoiceRequest as Record<string, unknown>)?.successMessage as string) || "Thank you!",
                          }}
                          styling={((previewWidgetVersion.widgets.invoiceRequest as Record<string, unknown>)?.styling || {}) as Partial<{
                            primaryColor: string;
                            secondaryColor: string;
                            backgroundColor: string;
                            textColor: string;
                            borderColor: string;
                            errorColor: string;
                            successColor: string;
                            fontFamily: string;
                            fontSize: string;
                            fontWeight: string;
                            padding: string;
                            gap: string;
                            borderRadius: string;
                            buttonPadding: string;
                            buttonBorderRadius: string;
                            buttonFontWeight: string;
                            modalBackdropOpacity: string;
                            modalBorderRadius: string;
                            modalMaxWidth: string;
                            shadow: string;
                          }>}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quote Request Preview */}
                {Boolean(previewWidgetVersion.widgets.quoteRequest && typeof previewWidgetVersion.widgets.quoteRequest === "object") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quote Request Widget</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 border rounded-lg bg-gray-50">
                        <WidgetPreview
                          widgetType="quoteRequest"
                          config={{
                            title: ((previewWidgetVersion.widgets.quoteRequest as Record<string, unknown>)?.title as string) || "Request Quote",
                            description: ((previewWidgetVersion.widgets.quoteRequest as Record<string, unknown>)?.description as string) || undefined,
                            submitButtonText: ((previewWidgetVersion.widgets.quoteRequest as Record<string, unknown>)?.submitButtonText as string) || "Submit",
                            successMessage: ((previewWidgetVersion.widgets.quoteRequest as Record<string, unknown>)?.successMessage as string) || "Thank you!",
                          }}
                          styling={((previewWidgetVersion.widgets.quoteRequest as Record<string, unknown>)?.styling || {}) as Partial<{
                            primaryColor: string;
                            secondaryColor: string;
                            backgroundColor: string;
                            textColor: string;
                            borderColor: string;
                            errorColor: string;
                            successColor: string;
                            fontFamily: string;
                            fontSize: string;
                            fontWeight: string;
                            padding: string;
                            gap: string;
                            borderRadius: string;
                            buttonPadding: string;
                            buttonBorderRadius: string;
                            buttonFontWeight: string;
                            modalBackdropOpacity: string;
                            modalBorderRadius: string;
                            modalMaxWidth: string;
                            shadow: string;
                          }>}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!previewWidgetVersion.widgets.contactForm &&
                  !previewWidgetVersion.widgets.invoiceRequest &&
                  !previewWidgetVersion.widgets.quoteRequest && (
                    <div className="text-center py-8 text-gray-500">
                      No widget configuration found in this version.
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

