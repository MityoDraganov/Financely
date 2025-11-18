import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Eye, RefreshCw, AlertCircle, ChevronRight, ChevronDown, Menu, X, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useGenerateWidget } from "@/hooks/service-hooks/use-generate-widget";
import { useRestoreWidgetVersion } from "@/hooks/service-hooks/use-widget-versioning";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useGenerateSite, useRegenerateSite, useAddCustomDomain, useRestoreBrandSiteVersion, usePreviewBrandSiteVersion, useDeployManualSite, useUpdateBrandSitePages } from "@/hooks/service-hooks/use-brand-site";
import { useBrandSite, useBrandSitesByOrganization, useUpdateBrandSite } from "@/hooks/repository-hooks/use-brand-site";
import { projectId } from "@/infrastructure/firebase";
import { AIChatBuilder } from "@/components/site-builder/ai-chat-builder";
import { WidgetEnableToggle } from "@/components/site-builder/widget-enable-toggle";
import { AddPageDialog } from "@/components/site-builder/add-page-dialog";
import { ContactFormWidgetConfig } from "@/components/site-builder/contact-form-widget-config";
import { InvoiceRequestWidgetConfig } from "@/components/site-builder/invoice-request-widget-config";
import { QuoteRequestWidgetConfig } from "@/components/site-builder/quote-request-widget-config";
import { WidgetVersionHistory } from "@/components/site-builder/widget-version-history";
import { EmbedScriptSection } from "@/components/site-builder/embed-script-section";
import { ManualEditorTab } from "@/components/site-builder/manual-editor-tab";
import { SiteStatusDisplay } from "@/components/site-builder/site-status-display";
import { SiteVersionHistory } from "@/components/site-builder/site-version-history";
import { CustomDomainInput } from "@/components/site-builder/custom-domain-input";
import type { WidgetPosition } from "@/components/site-builder/widget-types";
import { WidgetPreview } from "@/components/widget-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type PageType = "standard" | "blog" | "contact";

type PageContentEntry = {
  id: string;
  title: string;
  summary?: string;
  link?: string;
  image?: string;
};

type SitePage = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  context?: string;
  type?: PageType;
  order?: number;
  contentEntries?: PageContentEntry[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const createPageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `page-${Date.now()}`;

const createContentEntryId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function SiteBuilderPage() {
  const queryClient = useQueryClient();
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [domainStatus, setDomainStatus] = useState<string | undefined>();
  const [dnsConfigured, setDnsConfigured] = useState<boolean | undefined>();
  const [dnsInstructions, setDnsInstructions] = useState<{
    type: "A" | "CNAME";
    name: string;
    value: string;
    ttl?: number;
  } | undefined>();
  const [domainMessage, setDomainMessage] = useState<string | undefined>();
  const [previewingVersion, setPreviewingVersion] = useState<number | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [pageDialogMode, setPageDialogMode] = useState<"create" | "edit">("create");
  const [pageBeingEdited, setPageBeingEdited] = useState<SitePage | null>(null);
  const [pagePendingDelete, setPagePendingDelete] = useState<SitePage | null>(null);
  const [hasUnpublishedPages, setHasUnpublishedPages] = useState(false);
  const updateBrandSitePages = useUpdateBrandSitePages();
  const updateBrandSite = useUpdateBrandSite(); // For file updates (not pages)
  const generateSite = useGenerateSite();
  const regenerateSite = useRegenerateSite();
  const addCustomDomain = useAddCustomDomain();
  const restoreVersion = useRestoreBrandSiteVersion();
  const previewVersion = usePreviewBrandSiteVersion();
  const deployManualSite = useDeployManualSite();
  const [currentBrandSiteId, setCurrentBrandSiteId] = useState<string | null>(null);
  const brandSite = useBrandSite(currentBrandSiteId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pages: false,
    widgets: false,
    advanced: false,
  });
  
  // Reset unpublished pages flag when site is successfully deployed
  useEffect(() => {
    if (brandSite?.data?.status === "success") {
      setHasUnpublishedPages(false);
    }
  }, [brandSite?.data?.status]);
  
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

  const rawPages =
    ((brandSite?.data as { pages?: SitePage[] })?.pages as SitePage[] | undefined) ??
    [];
  
  // Ensure all page IDs are unique strings
  const seenPageIds = new Set<string>();
  const currentPages: SitePage[] = rawPages
    .map((page, index) => {
      let pageId = page.id ? String(page.id) : createPageId();
      // If ID is already seen, generate a new one
      if (seenPageIds.has(pageId)) {
        pageId = createPageId();
      }
      seenPageIds.add(pageId);
      
      // Ensure all entry IDs are unique strings
      const seenEntryIds = new Set<string>();
      const contentEntries = (page.contentEntries || []).map((entry) => {
        let entryId = entry.id ? String(entry.id) : createContentEntryId();
        // If ID is already seen, generate a new one
        if (seenEntryIds.has(entryId)) {
          entryId = createContentEntryId();
        }
        seenEntryIds.add(entryId);
        
        return {
          ...entry,
          id: entryId,
        };
      });
      
      return {
        ...page,
        id: pageId,
        order: page.order ?? index,
        contentEntries,
      };
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  
  const persistPages = async (nextPages: SitePage[]) => {
    if (!currentBrandSiteId) {
      toast.error("Generate a site before managing pages.");
      return;
    }
    const normalized = nextPages.map((page, index) => ({
      ...page,
      order: index,
    }));
    await updateBrandSitePages.mutateAsync({
      brandSiteId: currentBrandSiteId,
      pages: normalized,
    });
    setHasUnpublishedPages(true);
  };

  const handlePublishPages = () => {
    if (!currentBrandSiteId) return;
    setHasUnpublishedPages(false);
    regenerateSite.mutate({
      brandSiteId: currentBrandSiteId,
    });
  };

  const handleAddPage = async (pageForm: {
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  }) => {
    if (!pageForm.title.trim()) {
      toast.error("Page title is required");
      return;
    }

    const baseSlugInput = pageForm.slug.trim() || pageForm.title.trim();
    const isFirstPage = currentPages.length === 0;
    const normalizedSlug = isFirstPage
      ? "index"
      : slugify(baseSlugInput) || `page-${currentPages.length + 1}`;

    const slugExists = currentPages.some((page) => page.slug === normalizedSlug);
    const slug = slugExists
      ? `${normalizedSlug}-${Date.now().toString(36)}`
      : normalizedSlug;

    const newPage: SitePage = {
      id: createPageId(),
      title: pageForm.title.trim(),
      slug,
      description: pageForm.description.trim() || undefined,
      context: pageForm.context.trim() || undefined,
      type: pageForm.type,
      order: currentPages.length,
      contentEntries: [],
    };

    await persistPages([...currentPages, newPage]);
    setIsPageDialogOpen(false);
  };

  const handleUpdatePage = async (pageId: string, pageForm: {
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  }) => {
    if (!pageForm.title.trim()) {
      toast.error("Page title is required");
      return;
    }

    const targetPage = currentPages.find((page) => page.id === pageId);
    if (!targetPage) {
      toast.error("Page not found");
      return;
    }

    const baseSlugInput =
      pageForm.slug.trim() ||
      pageForm.title.trim() ||
      targetPage.slug ||
      `page-${Date.now().toString(36)}`;
    const fallbackSlug =
      (targetPage.order ?? 0) === 0
        ? "index"
        : targetPage.slug || `page-${Date.now().toString(36)}`;
    const normalizedSlug = slugify(baseSlugInput) || fallbackSlug;
    const slugConflict = currentPages.some(
      (page) => page.id !== pageId && page.slug === normalizedSlug,
    );
    const slug = slugConflict
      ? `${normalizedSlug}-${Date.now().toString(36).slice(2, 7)}`
      : normalizedSlug;

    const updatedPages = currentPages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            title: pageForm.title.trim(),
            slug,
            description: pageForm.description.trim() || undefined,
            context: pageForm.context.trim() || undefined,
            type: pageForm.type,
          }
        : page,
    );

    await persistPages(updatedPages);
    setIsPageDialogOpen(false);
    setPageDialogMode("create");
    setPageBeingEdited(null);
  };

  const handleRemovePage = async (pageId: string) => {
    if (currentPages.length <= 1) {
      toast.error("Your site needs at least one page.");
      return;
    }

    const nextPages = currentPages.filter((page) => page.id !== pageId);
    if (nextPages.length === currentPages.length) {
      toast.error("Page not found");
      return;
    }

    await persistPages(nextPages);
    setPagePendingDelete(null);
  };

  const openCreatePageDialog = () => {
    setPageDialogMode("create");
    setPageBeingEdited(null);
    setIsPageDialogOpen(true);
  };

  const openEditPageDialog = (page: SitePage) => {
    setPageDialogMode("edit");
    setPageBeingEdited(page);
    setIsPageDialogOpen(true);
  };

  const editingPageFormValues = useMemo(() => {
    if (pageDialogMode !== "edit" || !pageBeingEdited) {
      return null;
    }

    return {
      title: pageBeingEdited.title,
      slug: pageBeingEdited.slug,
      description: pageBeingEdited.description ?? "",
      context: pageBeingEdited.context ?? "",
      type: pageBeingEdited.type ?? "standard",
    };
  }, [pageDialogMode, pageBeingEdited]);

  const handlePageDialogOpenChange = (open: boolean) => {
    setIsPageDialogOpen(open);
    if (open) {
      return;
    }
    setPageDialogMode("create");
    setPageBeingEdited(null);
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const hasSite = brandSites.length > 0 && currentBrandSiteId;
  const deployedUrl = brandSite?.data?.deployedUrl;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Site Builder</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Chat with AI to create and update your website
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {hasSite && deployedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(deployedUrl, "_blank")}
                  className="gap-2 whitespace-nowrap min-w-fit"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">View Site</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden shrink-0"
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 p-6 overflow-y-auto">
          {hasSite ? (
            <AIChatBuilder
              brandSiteId={currentBrandSiteId}
              organizationId={organization?.id || ""}
              onSiteUpdated={() => {
                queryClient.invalidateQueries({
                  queryKey: ["brandSite", currentBrandSiteId],
                });
              }}
            />
          ) : (
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Create Your First Website</h2>
                  <p className="text-muted-foreground max-w-md">
                    Start by describing what you want your website to be. The AI will help you create a beautiful, branded site.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => {
                    if (!organization?.id) return;
                    generateSite.mutate(
                      {
                        organizationId: organization.id,
                        brandName: organization.settings?.branding?.companyName || organization.name,
                        tone: "professional",
                        pages: currentPages,
                      },
                      {
                        onSuccess: (result) => {
                          setCurrentBrandSiteId(result.id);
                          toast.success("Site created! Start chatting to customize it.");
                        },
                      }
                    );
                  }}
                  disabled={generateSite.isPending || !organization?.id}
                  className="gap-2"
                >
                  {generateSite.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create Site
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sidebar - Advanced Features */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } fixed lg:sticky top-0 right-0 h-full w-full lg:w-96 border-l bg-background z-40 transition-transform duration-300 ease-in-out overflow-y-auto`}
      >
        <div className="p-6 space-y-4">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h2 className="text-lg font-semibold">Settings & Tools</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Site Status */}
          {hasSite && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Site Status</CardTitle>
              </CardHeader>
              <CardContent>
                <SiteStatusDisplay
                  brandSite={brandSite?.data || null}
                />
              </CardContent>
            </Card>
          )}

          {/* Pages Section */}
          <Collapsible
            open={expandedSections.pages}
            onOpenChange={() => toggleSection("pages")}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pages</CardTitle>
                    {expandedSections.pages ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {hasUnpublishedPages && (
                    <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-sm">Pages Updated</AlertTitle>
                      <AlertDescription className="text-xs">
                        Changes saved. Regenerate to publish.
                      </AlertDescription>
                      <Button
                        size="sm"
                        onClick={handlePublishPages}
                        disabled={regenerateSite.isPending}
                        className="mt-2 w-full"
                      >
                        {regenerateSite.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Publish Changes
                          </>
                        )}
                      </Button>
                    </Alert>
                  )}
                  <Button
                    onClick={openCreatePageDialog}
                    disabled={!currentBrandSiteId || updateBrandSitePages.isPending}
                    size="sm"
                    className="w-full"
                  >
                    Add Page
                  </Button>
                  {currentPages.length > 0 && (
                    <div className="space-y-2">
                      {currentPages.map((page) => (
                        <div
                          key={page.id}
                          className="flex items-start justify-between gap-3 rounded border bg-muted/30 p-3"
                        >
                          <div>
                            <div className="font-medium">{page.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {page.slug === "index" ? "/" : `/${page.slug}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => openEditPageDialog(page)}
                              aria-label={`Edit ${page.title}`}
                              disabled={updateBrandSitePages.isPending}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setPagePendingDelete(page)}
                              aria-label={`Remove ${page.title}`}
                              disabled={updateBrandSitePages.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Advanced Settings */}
          {hasSite && (
            <Collapsible
              open={expandedSections.advanced}
              onOpenChange={() => toggleSection("advanced")}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Advanced</CardTitle>
                      {expandedSections.advanced ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <SiteVersionHistory
                      brandSite={brandSite?.data || null}
                      currentVersion={brandSite?.data?.metadata?.version ?? null}
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
                          if (result?.previewUrl) {
                            window.open(result.previewUrl, "_blank");
                            toast.success("Preview opened in new tab");
                          }
                        } catch (error) {
                          console.error("Failed to create preview:", error);
                        } finally {
                          setTimeout(() => setPreviewingVersion(null), 500);
                        }
                      }}
                      onRestoreVersion={(version: number) => {
                        const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                        if (!brandSiteId) return;
                        restoreVersion.mutate({ brandSiteId, version });
                      }}
                      isRestoring={restoreVersion.isPending}
                    />
                    <CustomDomainInput
                      customDomain={customDomainInput}
                      onCustomDomainChange={setCustomDomainInput}
                      onAddDomain={() => {
                        const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                        if (!brandSiteId || !customDomainInput) {
                          toast.error("Please enter a domain");
                          return;
                        }
                        addCustomDomain.mutate(
                          {
                            brandSiteId,
                            customDomain: customDomainInput,
                          },
                          {
                            onSuccess: (result) => {
                              setDomainStatus(result.domainStatus);
                              setDnsConfigured(result.dnsConfigured);
                              setDnsInstructions(result.dnsInstructions);
                              setDomainMessage(result.message);
                            },
                          }
                        );
                      }}
                      isAdding={addCustomDomain.isPending}
                      domainStatus={domainStatus}
                      dnsConfigured={dnsConfigured}
                      dnsInstructions={dnsInstructions}
                      message={domainMessage}
                    />
                    <div className="pt-4 border-t">
                      <ManualEditorTab
                        hasSite={!!hasSite}
                        brandSite={brandSite?.data || brandSites[0] || null}
                        organizationId={organization?.id || ""}
                        organizationName={organization?.name || ""}
                        companyName={organization?.settings?.branding?.companyName}
                        projectId={projectId || ""}
                        onCreateBlankSite={async () => {
                          if (!organization?.id) return;
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
                              pages: currentPages,
                            },
                            {
                              onSuccess: async (result) => {
                                setCurrentBrandSiteId(result.id);
                                await updateBrandSite.mutateAsync({
                                  id: result.id,
                                  data: {
                                    html: blankHtml,
                                    files: {
                                      "index.html": blankHtml,
                                    },
                                  },
                                });
                                toast.success("Blank site created!");
                              },
                            }
                          );
                        }}
                        isCreating={generateSite.isPending}
                        onSaveFiles={async (files) => {
                          if (!currentBrandSiteId) return;
                          await updateBrandSite.mutateAsync({
                            id: currentBrandSiteId,
                            data: {
                              files,
                              html: files["index.html"] || files["/index.html"] || brandSite?.data?.html || "",
                            },
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
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Widgets Section */}
          <Collapsible
            open={expandedSections.widgets}
            onOpenChange={() => toggleSection("widgets")}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Integration Widgets</CardTitle>
                    {expandedSections.widgets ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
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

                      {organization?.settings?.widgets?.versions &&
                        organization.settings.widgets.versions.length > 0 && (
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

                      <EmbedScriptSection
                        script={getEmbedScript()}
                        copied={copiedScript}
                        onCopy={handleCopyScript}
                      />
                    </>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Dialogs */}
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

      {/* Page Creation Dialog */}
      <AddPageDialog
        open={isPageDialogOpen}
        onOpenChange={handlePageDialogOpenChange}
        onSubmit={(pageForm) => {
          if (pageDialogMode === "edit" && pageBeingEdited) {
            return handleUpdatePage(pageBeingEdited.id, pageForm);
          }
          return handleAddPage(pageForm);
        }}
        isPending={updateBrandSitePages.isPending}
        initialValues={editingPageFormValues}
        mode={pageDialogMode}
      />
      <AlertDialog
        open={Boolean(pagePendingDelete)}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          setPagePendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove page?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${pagePendingDelete?.title ?? "This page"}" will be removed from your site navigation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateBrandSitePages.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!pagePendingDelete) {
                  return;
                }
                await handleRemovePage(pagePendingDelete.id);
              }}
              disabled={updateBrandSitePages.isPending}
            >
              {updateBrandSitePages.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
