import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Eye, Settings2, Code } from "lucide-react";
import { useGenerateWidget } from "@/hooks/service-hooks/use-generate-widget";
import { useRestoreWidgetVersion } from "@/hooks/service-hooks/use-widget-versioning";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useGenerateSite, useRegenerateSite, useAddCustomDomain, useRestoreBrandSiteVersion, usePreviewBrandSiteVersion, useDeployManualSite } from "@/hooks/service-hooks/use-brand-site";
import { useBrandSite, useBrandSitesByOrganization } from "@/hooks/repository-hooks/use-brand-site";
import { projectId } from "@/infrastructure/firebase";
import { AIGenerationTab } from "@/components/site-builder/ai-generation-tab";
import { ManualEditorTab } from "@/components/site-builder/manual-editor-tab";
import { WidgetEnableToggle } from "@/components/site-builder/widget-enable-toggle";
import { ContactFormWidgetConfig } from "@/components/site-builder/contact-form-widget-config";
import { InvoiceRequestWidgetConfig } from "@/components/site-builder/invoice-request-widget-config";
import { QuoteRequestWidgetConfig } from "@/components/site-builder/quote-request-widget-config";
import { WidgetVersionHistory } from "@/components/site-builder/widget-version-history";
import { EmbedScriptSection } from "@/components/site-builder/embed-script-section";
import type { WidgetPosition } from "@/components/site-builder/widget-types";
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

  // Helper function to normalize localization (backward compatibility)
  const normalizeLocalization = (localization: unknown): { defaultLanguage: "en"; languages: Record<string, Record<string, string>> } => {
    if (!localization || typeof localization !== "object") {
      return { defaultLanguage: "en", languages: {} };
    }

    // New format
    if ("defaultLanguage" in localization && "languages" in localization) {
      return {
        defaultLanguage: "en",
        languages: (localization as { languages?: Record<string, Record<string, string>> }).languages || {},
      };
    }

    // Old format (backward compatibility)
    if ("language" in localization && "translations" in localization) {
      const oldLoc = localization as { language?: string; translations?: Record<string, string> };
      const lang = oldLoc.language || "en";
      const translations = oldLoc.translations || {};
      
      // If language is not "en", migrate to new format
      if (lang !== "en") {
        return {
          defaultLanguage: "en",
          languages: {
            [lang]: translations,
          },
        };
      }
      
      // If language is "en", return empty languages (English is default)
      return {
        defaultLanguage: "en",
        languages: {},
      };
    }

    return { defaultLanguage: "en", languages: {} };
  };

  // Widget-specific localization state
  const [contactFormLocalization, setContactFormLocalization] = useState<{
    defaultLanguage: "en";
    languages: Record<string, Record<string, string>>;
  }>({
    defaultLanguage: "en",
    languages: {},
  });
  const [invoiceRequestLocalization, setInvoiceRequestLocalization] = useState<{
    defaultLanguage: "en";
    languages: Record<string, Record<string, string>>;
  }>({
    defaultLanguage: "en",
    languages: {},
  });
  const [quoteRequestLocalization, setQuoteRequestLocalization] = useState<{
    defaultLanguage: "en";
    languages: Record<string, Record<string, string>>;
  }>({
    defaultLanguage: "en",
    languages: {},
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
        setContactFormLocalization(normalizeLocalization(widgets.contactForm.localization));
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
        setInvoiceRequestLocalization(normalizeLocalization(widgets.invoiceRequest.localization));
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
        setQuoteRequestLocalization(normalizeLocalization(widgets.quoteRequest.localization));
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
            widgets: widgetsToSave as unknown as typeof existingWidgets,
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
            <AIGenerationTab
              context={context}
              onContextChange={setContext}
              contextImages={contextImages}
              onContextImageUpload={handleContextUpload}
              onContextImageRemove={handleContextRemove}
              isUploading={contextFileUpload.isUploading}
              uploadProgress={contextFileUpload.uploadProgress}
              uploadError={contextFileUpload.error}
              brandSites={brandSites}
              currentBrandSite={brandSite?.data || null}
              onGenerate={() => {
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
              onRegenerate={() => {
                const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                if (!brandSiteId) return;
                regenerateSite.mutate({
                  brandSiteId,
                  context: context.trim() || undefined,
                  contextImages: contextImages.length > 0 ? contextImages : undefined,
                });
              }}
              isGenerating={generateSite.isPending}
              isRegenerating={regenerateSite.isPending}
              currentVersion={(brandSite?.data || brandSites[0])?.metadata?.version ?? null}
              previewingVersion={previewingVersion}
              onPreviewVersion={async (version: number) => {
                const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                if (!brandSiteId) return;
                
                setPreviewingVersion(version);
                
                try {
                  const result = await previewVersion.mutateAsync({
                    brandSiteId,
                    version,
                  });
                  
                  const previewUrl = result?.previewUrl;
                  if (previewUrl) {
                    const previewWindow = window.open(previewUrl, "_blank");
                    if (!previewWindow) {
                      toast.error("Popup blocked. Please allow popups for this site and try again.");
                    } else {
                      toast.success("Preview opened in new tab", {
                        duration: 2000,
                      });
                    }
                  }
                } catch (error) {
                  console.error("Failed to create preview:", error);
                  setPreviewingVersion(null);
                } finally {
                  setTimeout(() => {
                    setPreviewingVersion(null);
                  }, 500);
                }
              }}
              onRestoreVersion={(version: number) => {
                const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                if (!brandSiteId) return;
                restoreVersion.mutate({
                  brandSiteId,
                  version,
                });
              }}
              isRestoring={restoreVersion.isPending}
              customDomain={customDomainInput}
              onCustomDomainChange={setCustomDomainInput}
              onAddDomain={() => {
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
              isAddingDomain={addCustomDomain.isPending}
              generationError={generateSite.error instanceof Error ? generateSite.error : null}
            />
          </TabsContent>

          <TabsContent value="manual" className="space-y-6">
            <ManualEditorTab
              hasSite={brandSites.length > 0}
              brandSite={brandSite?.data || brandSites[0] || null}
              organizationId={organization?.id || ""}
              organizationName={organization?.name || ""}
              companyName={organization?.settings?.branding?.companyName}
              projectId={projectId || ""}
              onCreateBlankSite={async () => {
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
              isCreating={generateSite.isPending}
              onSaveFiles={async (files) => {
                if (!currentBrandSiteId) return;
                const db = getFirestore(firebase.app);
                await updateDoc(doc(db, "brandSites", currentBrandSiteId), {
                  files,
                  html: files["index.html"] || files["/index.html"] || brandSite?.data?.html || "",
                });
              }}
              onDeployFiles={async (files) => {
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
              widgetsEnabled={organization?.settings?.widgets?.enabled || false}
            />
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
            <WidgetEnableToggle
              enabled={widgetsEnabled}
              onToggle={setWidgetsEnabled}
            />

            {widgetsEnabled && (
              <>
                <ContactFormWidgetConfig
                  config={contactFormConfig}
                  onConfigChange={setContactFormConfig}
                  styling={contactFormStyling}
                  onStylingChange={setContactFormStyling}
                  localization={contactFormLocalization}
                  onLocalizationChange={setContactFormLocalization}
                  builtInFields={builtInFields}
                  onBuiltInFieldsChange={setBuiltInFields}
                  customFields={customFields}
                  onCustomFieldsChange={setCustomFields}
                  onAddCustomField={handleAddCustomField}
                  onRemoveCustomField={handleRemoveCustomField}
                  onUpdateCustomField={handleUpdateCustomField}
                  onOpenAiBuilder={() => {
                    setAiWidgetType("contactForm");
                    setAiWidgetDialogOpen(true);
                  }}
                  organizationId={organization?.id || ""}
                />

                <InvoiceRequestWidgetConfig
                  config={invoiceRequestConfig}
                  onConfigChange={setInvoiceRequestConfig}
                  styling={invoiceRequestStyling}
                  onStylingChange={setInvoiceRequestStyling}
                  localization={invoiceRequestLocalization}
                  onLocalizationChange={setInvoiceRequestLocalization}
                  onOpenAiBuilder={() => {
                    setAiWidgetType("invoiceRequest");
                    setAiWidgetDialogOpen(true);
                  }}
                  organizationId={organization?.id || ""}
                />

                <QuoteRequestWidgetConfig
                  config={quoteRequestConfig}
                  onConfigChange={setQuoteRequestConfig}
                  styling={quoteRequestStyling}
                  onStylingChange={setQuoteRequestStyling}
                  localization={quoteRequestLocalization}
                  onLocalizationChange={setQuoteRequestLocalization}
                  onOpenAiBuilder={() => {
                    setAiWidgetType("quoteRequest");
                    setAiWidgetDialogOpen(true);
                  }}
                  organizationId={organization?.id || ""}
                />

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

                  {organization?.settings?.widgets?.versions && organization.settings.widgets.versions.length > 0 && (
                    <WidgetVersionHistory
                      versions={organization.settings.widgets.versions.map((v) => ({
                        version: v.version,
                        widgetType: v.widgetType,
                        widgets: v.widgets,
                        createdAt: v.createdAt,
                        description: v.description,
                      }))}
                      currentVersion={organization.settings.widgets.metadata?.version ?? null}
                      onPreviewVersion={(version) => {
                        setPreviewWidgetVersion({
                          version: version.version,
                          widgets: version.widgets,
                        });
                        setPreviewWidgetDialogOpen(true);
                      }}
                      onRestoreVersion={async (version) => {
                        if (!organization?.id) return;
                        await restoreWidgetVersion.mutateAsync({
                          organizationId: organization.id,
                          version,
                          widgetType: "all",
                        });
                      }}
                      isRestoring={restoreWidgetVersion.isPending}
                    />
                  )}
                </div>

                {/* Embed Script */}
                <EmbedScriptSection
                  script={getEmbedScript()}
                  copied={copiedScript}
                  onCopy={handleCopyScript}
                />
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

