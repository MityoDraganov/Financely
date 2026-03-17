import { FunctionsService } from "@/core";
import { firebase, projectId } from "@/infrastructure/firebase";
import { httpsCallable } from "@firebase/functions";

const INVOICE_EXTRACTION_CALL_TIMEOUT_MS = 540_000;

export const functionsService: FunctionsService = {
  async createOrganization(payload) {
    type CreateOrganizationPayload = Parameters<FunctionsService["createOrganization"]>[0];
    type CreateOrganizationResponse = Awaited<ReturnType<FunctionsService["createOrganization"]>>;
    const result = await httpsCallable<
      CreateOrganizationPayload,
      CreateOrganizationResponse
    >(firebase.functions, "createOrganization")(payload);
    return result.data;
  },

  async createProposal(payload) {
    type CreateProposalPayload = Parameters<FunctionsService["createProposal"]>[0];
    const result = await httpsCallable<CreateProposalPayload, { id: string }>(
      firebase.functions,
      "createProposal",
    )(payload);
    return result.data;
  },

  async createInvoice(payload) {
    type CreateInvoicePayload = Parameters<FunctionsService["createInvoice"]>[0];
    const result = await httpsCallable<CreateInvoicePayload, { id: string }>(
      firebase.functions,
      "createInvoice",
    )(payload);
    return result.data;
  },

  async mapProductToInvoiceFields(payload) {
    type MapProductToInvoiceFieldsPayload = Parameters<FunctionsService["mapProductToInvoiceFields"]>[0];
    const result = await httpsCallable<
      MapProductToInvoiceFieldsPayload,
      { mappedFields: Record<string, unknown> }
    >(
      firebase.functions,
      "mapProductToInvoiceFields",
    )(payload);
    return result.data;
  },

  async generateProductTableConfig(payload) {
    type GenerateProductTableConfigPayload = Parameters<FunctionsService["generateProductTableConfig"]>[0];
    const result = await httpsCallable<
      GenerateProductTableConfigPayload,
      { productTableConfig: import("@/core/entities/template").ProductTableConfig }
    >(
      firebase.functions,
      "generateProductTableConfig",
    )(payload);
    return result.data;
  },

  async renderInvoicePdf(payload) {
    const result = await httpsCallable<typeof payload, { url: string }>(
      firebase.functions,
      "renderInvoicePdf",
    )(payload);
    return result.data;
  },

  async sendInvoiceEmail(payload) {
    const result = await httpsCallable<typeof payload, { sent: boolean }>(
      firebase.functions,
      "sendInvoiceEmail",
    )(payload);
    return result.data;
  },

  async previewInvoiceEmail(payload) {
    const result = await httpsCallable<
      typeof payload,
      {
        previewId: string;
        subject: string;
        html: string;
        text: string;
        toEmail: string;
        expiresAt: string;
      }
    >(firebase.functions, "previewInvoiceEmail")(payload);
    return result.data;
  },

  async sendProposalEmail(payload) {
    const result = await httpsCallable<typeof payload, { sent: boolean }>(
      firebase.functions,
      "sendProposalEmail",
    )(payload);
    return result.data;
  },

  async generateInvoiceShareLink(payload) {
    const result = await httpsCallable<typeof payload, { url: string }>(
      firebase.functions,
      "generateInvoiceShareLink",
    )(payload);
    return result.data;
  },

  async sendInviteEmail(payload) {
    const result = await httpsCallable<typeof payload, { sent: boolean }>(
      firebase.functions,
      "sendInviteEmail",
    )(payload);
    return result.data;
  },

  async sendWelcomeEmail(payload) {
    const result = await httpsCallable<typeof payload, { sent: boolean }>(
      firebase.functions,
      "sendWelcomeEmail",
    )(payload);
    return result.data;
  },

  async acceptInvite(payload: { code: string }): Promise<{ success: boolean; organizationId: string; message: string }> {
    const result = await httpsCallable<{ code: string }, { success: boolean; organizationId: string; message: string }>(
      firebase.functions,
      "acceptInvite",
    )(payload);
    return result.data;
  },

  async revokeMember(payload: { organizationId: string; memberId: string }): Promise<{ success: boolean; message: string }> {
    const result = await httpsCallable<
      { organizationId: string; memberId: string },
      { success: boolean; message: string }
    >(
      firebase.functions,
      "revokeMember",
    )(payload);
    return result.data;
  },

  async transferOrganizationOwnership(payload: { organizationId: string; newOwnerId: string }): Promise<{ success: boolean; message: string }> {
    const result = await httpsCallable<
      { organizationId: string; newOwnerId: string },
      { success: boolean; message: string }
    >(
      firebase.functions,
      "transferOrganizationOwnership",
    )(payload);
    return result.data;
  },

  async createWorkflow(payload) {
    type CreateWorkflowPayload = Parameters<FunctionsService["createWorkflow"]>[0];
    const result = await httpsCallable<CreateWorkflowPayload, { id: string }>(
      firebase.functions,
      "createWorkflow",
    )(payload);
    return result.data;
  },

  async generateSite(payload) {
    type GenerateSitePayload = Parameters<FunctionsService["generateSite"]>[0];
    const result = await httpsCallable<
      GenerateSitePayload,
      { id: string; status: string }
    >(firebase.functions, "generateSite")(payload);
    return result.data;
  },

  async regenerateSite(payload) {
    type RegenerateSitePayload = Parameters<
      FunctionsService["regenerateSite"]
    >[0];
    const result = await httpsCallable<
      RegenerateSitePayload,
      { success: boolean; brandSiteId: string; status: string }
    >(firebase.functions, "regenerateSite")(payload);
    return result.data;
  },

  async chatGenerateSite(payload) {
    type ChatGenerateSitePayload = Parameters<
      FunctionsService["chatGenerateSite"]
    >[0];
    const result = await httpsCallable<
      ChatGenerateSitePayload,
      { response: string; updated: boolean; requiresClarification: boolean; brandSiteId: string; chatRequestId?: string }
    >(firebase.functions, "chatGenerateSite")(payload);
    return result.data;
  },

  async updateAnalyticsScript(payload) {
    type UpdateAnalyticsScriptPayload = Parameters<
      FunctionsService["updateAnalyticsScript"]
    >[0];
    const result = await httpsCallable<
      UpdateAnalyticsScriptPayload,
      { success: boolean; brandSiteId: string }
    >(firebase.functions, "updateAnalyticsScript")(payload);
    return result.data;
  },

  async addCustomDomain(payload) {
    type AddCustomDomainPayload = Parameters<
      FunctionsService["addCustomDomain"]
    >[0];
    type AddCustomDomainResponse = Awaited<ReturnType<FunctionsService["addCustomDomain"]>>;
    const result = await httpsCallable<
      AddCustomDomainPayload,
      AddCustomDomainResponse
    >(firebase.functions, "addCustomDomain")(payload);
    return result.data;
  },

  async removeCustomDomain(payload: Parameters<FunctionsService["removeCustomDomain"]>[0]) {
    type RemoveCustomDomainPayload = Parameters<FunctionsService["removeCustomDomain"]>[0];
    type RemoveCustomDomainResponse = Awaited<ReturnType<FunctionsService["removeCustomDomain"]>>;
    const result = await httpsCallable<
      RemoveCustomDomainPayload,
      RemoveCustomDomainResponse
    >(firebase.functions, "removeCustomDomain")(payload);
    return result.data;
  },

  async restoreBrandSiteVersion(payload) {
    type RestoreVersionPayload = Parameters<
      FunctionsService["restoreBrandSiteVersion"]
    >[0];
    const result = await httpsCallable<
      RestoreVersionPayload,
      { success: boolean; brandSiteId: string; restoredVersion: number }
    >(firebase.functions, "restoreBrandSiteVersion")(payload);
    return result.data;
  },

  async previewBrandSiteVersion(payload) {
    type PreviewVersionPayload = Parameters<
      FunctionsService["previewBrandSiteVersion"]
    >[0];
    const result = await httpsCallable<
      PreviewVersionPayload,
      { success: boolean; brandSiteId: string; version: number; previewUrl: string }
    >(firebase.functions, "previewBrandSiteVersion")(payload);
    return result.data;
  },

  async updateBrandSitePages(payload) {
    type UpdateBrandSitePagesPayload = Parameters<
      FunctionsService["updateBrandSitePages"]
    >[0];
    const result = await httpsCallable<
      UpdateBrandSitePagesPayload,
      { success: boolean; brandSiteId: string }
    >(firebase.functions, "updateBrandSitePages")(payload);
    return result.data;
  },

  async deployManualSite(payload) {
    type DeployManualSitePayload = Parameters<
      FunctionsService["deployManualSite"]
    >[0];
    const result = await httpsCallable<
      DeployManualSitePayload,
      { success: boolean; brandSiteId: string; deployedUrl: string; status: string }
    >(firebase.functions, "deployManualSite")(payload);
    return result.data;
  },

  async publishBrandSite(payload) {
    type PublishBrandSitePayload = Parameters<
      FunctionsService["publishBrandSite"]
    >[0];
    const result = await httpsCallable<
      PublishBrandSitePayload,
      { success: boolean; brandSiteId: string; versionId: string; publishedDomains: string[]; deployedUrl?: string }
    >(firebase.functions, "publishBrandSite")(payload);
    return result.data;
  },

  async generateProposalSuggestion(payload: {
    leadId: string;
    organizationId: string;
  }): Promise<{
    title: string;
    description?: string;
    items: Array<{
      description: string;
      qty: number;
      unitPrice: number;
      taxPct?: number;
    }>;
    currency: string;
    terms?: string;
    notes?: string;
    organizationId: string;
    leadId: string;
    status: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    aiGenerated: boolean;
  }> {
    type GenerateProposalSuggestionPayload = Parameters<
      FunctionsService["generateProposalSuggestion"]
    >[0];
    const result = await httpsCallable<
      GenerateProposalSuggestionPayload,
      {
        title: string;
        description?: string;
        items: Array<{
          description: string;
          qty: number;
          unitPrice: number;
          taxPct?: number;
        }>;
        currency: string;
        terms?: string;
        notes?: string;
        organizationId: string;
        leadId: string;
        status: string;
        subtotal: number;
        taxTotal: number;
        total: number;
        aiGenerated: boolean;
      }
    >(firebase.functions, "generateProposalSuggestion")(payload);
    return result.data;
  },

  async generateInvoiceTemplate(payload: {
    organizationId: string;
    region?: "US" | "EU" | "CA" | "AU" | "UK";
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      includeLogo?: boolean;
      customPrompt?: string;
    };
  }): Promise<{
    orgId: string;
    name: string;
    description?: string;
    pageSize: "A4" | "Letter";
    brand: {
      fonts: string[];
      colors: { primary: string; secondary: string; accent: string };
      margins: { top: number; right: number; bottom: number; left: number };
    };
    elements: Array<any>;
    status: "draft" | "published";
    compliance?: {
      region?: "US" | "EU" | "CA" | "AU" | "UK";
      requiredFields?: string[];
      autoFooter?: boolean;
      customFooter?: string;
      complianceValidated?: boolean;
      complianceValidatedAt?: string;
    };
  }> {
    type GenerateInvoiceTemplatePayload = Parameters<
      FunctionsService["generateInvoiceTemplate"]
    >[0];
    const result = await httpsCallable<
      GenerateInvoiceTemplatePayload,
      {
        orgId: string;
        name: string;
        description?: string;
        pageSize: "A4" | "Letter";
        brand: {
          fonts: string[];
          colors: { primary: string; secondary: string; accent: string };
          margins: { top: number; right: number; bottom: number; left: number };
        };
        elements: Array<any>;
        status: "draft" | "published";
        compliance?: {
          region?: "US" | "EU" | "CA" | "AU" | "UK";
          requiredFields?: string[];
          autoFooter?: boolean;
          customFooter?: string;
          complianceValidated?: boolean;
          complianceValidatedAt?: string;
        };
      }
    >(firebase.functions, "generateInvoiceTemplate")(payload);
    return result.data;
  },

  async generateEmailTemplate(payload: {
    organizationId: string;
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
      customPrompt?: string;
      images?: Array<{
        url: string;
        purpose: "reference" | "use-in-template";
        description?: string;
      }>;
      context?: {
        products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
        organizationName?: string;
        organizationSettings?: Record<string, unknown>;
        galleryImages?: string[];
      };
      allowedContexts?: string[];
      dynamicSources?: Array<{
        placeholderKey: string;
        entity: "product" | "contact" | "invoice" | "proposal";
        path: string;
        label?: string;
        description?: string;
        valueType?: "string" | "number" | "boolean" | "date" | "array" | "object" | "unknown";
        required?: boolean;
        sourceKind?: "field" | "metafield";
      }>;
      generateCustomHtml?: boolean;
      targetSection?: "header" | "body" | "footer" | "full";
    };
  }): Promise<{
    orgId: string;
    name: string;
    description?: string;
    subject: string;
    preheader?: string;
    htmlContent: string;
    blocks: Array<any>;
    designTokens: {
      background: string;
      surface: string;
      text: string;
      primary: string;
      fontFamily: string;
      borderRadius: number;
    };
    allowedContexts?: string[];
    placeholders?: Array<{
      id: string;
      key: string;
      label?: string;
      description?: string;
      source?: {
        type: "entity_field";
        entity: "product" | "contact" | "invoice" | "proposal";
        path: string;
        valueType?: "string" | "number" | "boolean" | "date" | "array" | "object" | "unknown";
      };
    }>;
    sections?: {
      header: string[];
      body: string[];
      footer: string[];
    };
    status: "draft" | "published";
  }> {
    type GenerateEmailTemplatePayload = Parameters<
      FunctionsService["generateEmailTemplate"]
    >[0];
    const result = await httpsCallable<
      GenerateEmailTemplatePayload,
      {
        orgId: string;
        name: string;
        description?: string;
        subject: string;
        preheader?: string;
        htmlContent: string;
        blocks: Array<any>;
        designTokens: {
          background: string;
          surface: string;
          text: string;
          primary: string;
          fontFamily: string;
          borderRadius: number;
        };
        allowedContexts?: string[];
        placeholders?: Array<{
          id: string;
          key: string;
          label?: string;
          description?: string;
          source?: {
            type: "entity_field";
            entity: "product" | "contact" | "invoice" | "proposal";
            path: string;
            valueType?: "string" | "number" | "boolean" | "date" | "array" | "object" | "unknown";
          };
        }>;
        sections?: {
          header: string[];
          body: string[];
          footer: string[];
        };
        status: "draft" | "published";
      }
    >(firebase.functions, "generateEmailTemplate")(payload);
    return result.data;
  },

  async createProduct(payload) {
    type CreateProductPayload = Parameters<FunctionsService["createProduct"]>[0];
    const result = await httpsCallable<CreateProductPayload, { id: string }>(
      firebase.functions,
      "createProduct",
    )(payload);
    return result.data;
  },

  async backfillProductPublicPages(payload) {
    type BackfillProductPublicPagesPayload = Parameters<FunctionsService["backfillProductPublicPages"]>[0];
    type BackfillProductPublicPagesResponse = Awaited<ReturnType<FunctionsService["backfillProductPublicPages"]>>;
    const result = await httpsCallable<
      BackfillProductPublicPagesPayload,
      BackfillProductPublicPagesResponse
    >(firebase.functions, "backfillProductPublicPages")(payload);
    return result.data;
  },

  async convertProposalToInvoice(payload) {
    type ConvertProposalToInvoicePayload = Parameters<FunctionsService["convertProposalToInvoice"]>[0];
    const result = await httpsCallable<
      ConvertProposalToInvoicePayload,
      { invoiceId: string; invoiceNumber?: string }
    >(firebase.functions, "convertProposalToInvoice")(payload);
    return result.data;
  },

  async generateInvoiceFromProposal(payload) {
    type GenerateInvoiceFromProposalPayload = Parameters<FunctionsService["generateInvoiceFromProposal"]>[0];
    const result = await httpsCallable<
      GenerateInvoiceFromProposalPayload,
      Awaited<ReturnType<FunctionsService["generateInvoiceFromProposal"]>>
    >(firebase.functions, "generateInvoiceFromProposal")(payload);
    return result.data;
  },

  async generateWidget(payload) {
    type GenerateWidgetPayload = Parameters<FunctionsService["generateWidget"]>[0];
    const result = await httpsCallable<
      GenerateWidgetPayload,
      Awaited<ReturnType<FunctionsService["generateWidget"]>>
    >(firebase.functions, "generateWidget")(payload);
    return result.data;
  },

  async restoreWidgetVersion(payload) {
    type RestoreWidgetVersionPayload = Parameters<FunctionsService["restoreWidgetVersion"]>[0];
    const result = await httpsCallable<
      RestoreWidgetVersionPayload,
      Awaited<ReturnType<FunctionsService["restoreWidgetVersion"]>>
    >(firebase.functions, "restoreWidgetVersion")(payload);
    return result.data;
  },

  async saveWidgetVersion(payload) {
    type SaveWidgetVersionPayload = Parameters<FunctionsService["saveWidgetVersion"]>[0];
    const result = await httpsCallable<
      SaveWidgetVersionPayload,
      Awaited<ReturnType<FunctionsService["saveWidgetVersion"]>>
    >(firebase.functions, "saveWidgetVersion")(payload);
    return result.data;
  },

  async createWidgetDefinition(payload) {
    type P = Parameters<FunctionsService["createWidgetDefinition"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["createWidgetDefinition"]>>>(
      firebase.functions,
      "createWidgetDefinition"
    )(payload);
    return result.data;
  },

  async updateWidgetDefinition(payload) {
    type P = Parameters<FunctionsService["updateWidgetDefinition"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["updateWidgetDefinition"]>>>(
      firebase.functions,
      "updateWidgetDefinition"
    )(payload);
    return result.data;
  },

  async deleteWidgetDefinition(payload) {
    type P = Parameters<FunctionsService["deleteWidgetDefinition"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["deleteWidgetDefinition"]>>>(
      firebase.functions,
      "deleteWidgetDefinition"
    )(payload);
    return result.data;
  },

  async saveModularWidgetVersion(payload) {
    type P = Parameters<FunctionsService["saveModularWidgetVersion"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["saveModularWidgetVersion"]>>>(
      firebase.functions,
      "saveModularWidgetVersion"
    )(payload);
    return result.data;
  },

  async getModularWidgetDraft(payload) {
    type P = Parameters<FunctionsService["getModularWidgetDraft"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["getModularWidgetDraft"]>>>(
      firebase.functions,
      "getModularWidgetDraft"
    )(payload);
    return result.data;
  },

  async listWidgetDefinitions(payload) {
    type P = Parameters<FunctionsService["listWidgetDefinitions"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["listWidgetDefinitions"]>>>(
      firebase.functions,
      "listWidgetDefinitions"
    )(payload);
    return result.data;
  },

  async getModularWidgetConfig(params) {
    const { organizationId, widgetId, widgetVersionId } = params;
    const baseUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
    const url = new URL(baseUrl);
    url.pathname = "/getModularWidgetConfig";
    url.searchParams.set("organizationId", organizationId);
    url.searchParams.set("widgetId", widgetId);
    if (widgetVersionId) url.searchParams.set("widgetVersionId", widgetVersionId);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as {
        error?: string;
        branding?: unknown;
        pageConfig?: unknown;
      };
      const error = Object.assign(
        new Error(err.error ?? "Failed to load widget config"),
        {
          branding: err.branding ?? null,
          pageConfig: err.pageConfig ?? null,
        },
      );
      throw error;
    }
    return res.json();
  },

  async publishModularWidget(payload) {
    type P = Parameters<FunctionsService["publishModularWidget"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["publishModularWidget"]>>>(
      firebase.functions,
      "publishModularWidget"
    )(payload);
    return result.data;
  },

  async unpublishModularWidget(payload) {
    type P = Parameters<FunctionsService["unpublishModularWidget"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["unpublishModularWidget"]>>>(
      firebase.functions,
      "unpublishModularWidget"
    )(payload);
    return result.data;
  },

  async listModularWidgetVersions(payload) {
    type P = Parameters<FunctionsService["listModularWidgetVersions"]>[0];
    const result = await httpsCallable<P, Awaited<ReturnType<FunctionsService["listModularWidgetVersions"]>>>(
      firebase.functions,
      "listModularWidgetVersions"
    )(payload);
    return result.data;
  },

  async translateWidgetText(payload) {
    type TranslateWidgetTextPayload = Parameters<FunctionsService["translateWidgetText"]>[0];
    const result = await httpsCallable<
      TranslateWidgetTextPayload,
      Awaited<ReturnType<FunctionsService["translateWidgetText"]>>
    >(firebase.functions, "translateWidgetText")(payload);
    return result.data;
  },

  async getAnalyticsMetrics(payload) {
    type GetAnalyticsMetricsPayload = Parameters<FunctionsService["getAnalyticsMetrics"]>[0];
    const result = await httpsCallable<
      GetAnalyticsMetricsPayload,
      {
        pageViews: number;
        visitors: number;
        bounceRate: number;
        avgSessionDuration: number;
        topPages: Array<{ path: string; views: number }>;
        trafficSources: Array<{ source: string; visitors: number }>;
        devices: Array<{ device: string; visitors: number }>;
        browsers: Array<{ browser: string; visitors: number }>;
        referrers: Array<{ referrer: string; visitors: number }>;
        pageViewsOverTime: Array<{ date: string; views: number }>;
        dateRange: { start: string; end: string };
        warning?: string;
        indexError?: {
          message: string;
          indexUrl?: string;
        };
        dataSources?: Array<"firestore" | "ga4" | "plausible" | "umami" | "clarity">;
      }
    >(firebase.functions, "getAnalyticsMetrics")(payload);
    // Ensure all required fields are present, provide defaults if missing
    const data = result.data;
    return {
      ...data,
      devices: data.devices || [],
      browsers: data.browsers || [],
      referrers: data.referrers || [],
      pageViewsOverTime: data.pageViewsOverTime || [],
      dataSources: data.dataSources || [],
    };
  },

  async generateConsentBanner(payload) {
    type GenerateConsentBannerPayload = Parameters<FunctionsService["generateConsentBanner"]>[0];
    const result = await httpsCallable<
      GenerateConsentBannerPayload,
      Awaited<ReturnType<FunctionsService["generateConsentBanner"]>>
    >(firebase.functions, "generateConsentBanner")(payload);
    return result.data;
  },

  async uploadFile(payload) {
    type UploadFilePayload = Parameters<FunctionsService["uploadFile"]>[0];
    const result = await httpsCallable<UploadFilePayload, { url: string }>(
      firebase.functions,
      "uploadFile",
    )(payload);
    return result.data;
  },

  async improveText(payload) {
    type ImproveTextPayload = Parameters<FunctionsService["improveText"]>[0];
    const result = await httpsCallable<ImproveTextPayload, { improvedText: string }>(
      firebase.functions,
      "improveText",
    )(payload);
    return result.data;
  },

  async deleteBrandSite(payload) {
    type DeleteBrandSitePayload = Parameters<FunctionsService["deleteBrandSite"]>[0];
    const result = await httpsCallable<DeleteBrandSitePayload, { success: boolean; brandSiteId: string }>(
      firebase.functions,
      "deleteBrandSite",
    )(payload);
    return result.data;
  },

  async uploadInvoiceFile(payload) {
    type UploadPayload = Parameters<FunctionsService["uploadInvoiceFile"]>[0];
    type Response = Awaited<ReturnType<FunctionsService["uploadInvoiceFile"]>>;
    const result = await httpsCallable<
      { action: "upload" } & UploadPayload,
      { action: "upload"; jobId: string }
    >(firebase.functions, "invoiceExtraction", { timeout: INVOICE_EXTRACTION_CALL_TIMEOUT_MS })({
      action: "upload",
      ...payload,
    });
    return { jobId: (result.data as { jobId: string }).jobId } as Response;
  },

  async extractInvoiceData(payload) {
    type ExtractPayload = Parameters<FunctionsService["extractInvoiceData"]>[0];
    type Response = Awaited<ReturnType<FunctionsService["extractInvoiceData"]>>;
    const result = await httpsCallable<
      { action: "extract" } & ExtractPayload,
      { action: "extract"; job: unknown }
    >(firebase.functions, "invoiceExtraction", { timeout: INVOICE_EXTRACTION_CALL_TIMEOUT_MS })({
      action: "extract",
      ...payload,
    });
    return { job: (result.data as { job: unknown }).job } as Response;
  },

  async generateTemplateFromInvoiceFile(payload) {
    type GenPayload = Parameters<FunctionsService["generateTemplateFromInvoiceFile"]>[0];
    type Response = Awaited<ReturnType<FunctionsService["generateTemplateFromInvoiceFile"]>>;
    const result = await httpsCallable<
      { action: "generateTemplate" } & GenPayload,
      {
        action: "generateTemplate";
        template: Response["template"];
        quality: Response["quality"];
        needsReview: Response["needsReview"];
        reviewReasons: Response["reviewReasons"];
      }
    >(firebase.functions, "invoiceExtraction", { timeout: INVOICE_EXTRACTION_CALL_TIMEOUT_MS })({
      action: "generateTemplate",
      ...payload,
    });
    const data = result.data as {
      template: Response["template"];
      quality: Response["quality"];
      needsReview: Response["needsReview"];
      reviewReasons: Response["reviewReasons"];
    };
    return {
      template: data.template,
      quality: data.quality,
      needsReview: data.needsReview,
      reviewReasons: data.reviewReasons,
    } as Response;
  },

  async generateTemplateFromExtraction(payload) {
    return functionsService.generateTemplateFromInvoiceFile(payload);
  },

  async listAiModels(payload) {
    type ListAiModelsPayload = Parameters<FunctionsService["listAiModels"]>[0];
    type ListAiModelsResponse = Awaited<ReturnType<FunctionsService["listAiModels"]>>;
    const result = await httpsCallable<
      ListAiModelsPayload,
      ListAiModelsResponse
    >(firebase.functions, "listAiModels")(payload);
    return result.data;
  },

  async getUsageHistory(payload) {
    type GetUsageHistoryPayload = Parameters<FunctionsService["getUsageHistory"]>[0];
    type GetUsageHistoryResponse = Awaited<ReturnType<FunctionsService["getUsageHistory"]>>;
    const result = await httpsCallable<
      GetUsageHistoryPayload,
      GetUsageHistoryResponse
    >(firebase.functions, "getUsageHistory")(payload);
    return result.data;
  },

  async createExternalSource(payload) {
    type CreateExternalSourcePayload = Parameters<FunctionsService["createExternalSource"]>[0];
    type CreateExternalSourceResponse = Awaited<ReturnType<FunctionsService["createExternalSource"]>>;
    const result = await httpsCallable<
      CreateExternalSourcePayload,
      CreateExternalSourceResponse
    >(firebase.functions, "createExternalSource")(payload);
    return result.data;
  },

  async updateExternalSource(payload) {
    type UpdateExternalSourcePayload = Parameters<FunctionsService["updateExternalSource"]>[0];
    type UpdateExternalSourceResponse = Awaited<ReturnType<FunctionsService["updateExternalSource"]>>;
    const result = await httpsCallable<
      UpdateExternalSourcePayload,
      UpdateExternalSourceResponse
    >(firebase.functions, "updateExternalSource")(payload);
    return result.data;
  },

  async deleteExternalSource(payload) {
    type DeleteExternalSourcePayload = Parameters<FunctionsService["deleteExternalSource"]>[0];
    type DeleteExternalSourceResponse = Awaited<ReturnType<FunctionsService["deleteExternalSource"]>>;
    const result = await httpsCallable<
      DeleteExternalSourcePayload,
      DeleteExternalSourceResponse
    >(firebase.functions, "deleteExternalSource")(payload);
    return result.data;
  },

  async listExternalSources(payload) {
    type ListExternalSourcesPayload = Parameters<FunctionsService["listExternalSources"]>[0];
    type ListExternalSourcesResponse = Awaited<ReturnType<FunctionsService["listExternalSources"]>>;
    const result = await httpsCallable<
      ListExternalSourcesPayload,
      ListExternalSourcesResponse
    >(firebase.functions, "listExternalSources")(payload);
    return result.data;
  },

  async testExternalSourceConnection(payload) {
    type TestConnectionPayload = Parameters<FunctionsService["testExternalSourceConnection"]>[0];
    type TestConnectionResponse = Awaited<ReturnType<FunctionsService["testExternalSourceConnection"]>>;
    const result = await httpsCallable<
      TestConnectionPayload,
      TestConnectionResponse
    >(firebase.functions, "testExternalSourceConnection")(payload);
    return result.data;
  },

  async refreshExternalSource(payload) {
    type RefreshSourcePayload = Parameters<FunctionsService["refreshExternalSource"]>[0];
    type RefreshSourceResponse = Awaited<ReturnType<FunctionsService["refreshExternalSource"]>>;
    const result = await httpsCallable<
      RefreshSourcePayload,
      RefreshSourceResponse
    >(firebase.functions, "refreshExternalSource")(payload);
    return result.data;
  },

  // Marketplace functions
  async listMarketplaceTemplates(payload) {
    type ListTemplatesPayload = Parameters<FunctionsService["listMarketplaceTemplates"]>[0];
    type ListTemplatesResponse = Awaited<ReturnType<FunctionsService["listMarketplaceTemplates"]>>;
    const result = await httpsCallable<
      ListTemplatesPayload,
      ListTemplatesResponse
    >(firebase.functions, "listMarketplaceTemplates")(payload);
    return result.data;
  },

  async getMarketplaceTemplate(payload) {
    type GetTemplatePayload = Parameters<FunctionsService["getMarketplaceTemplate"]>[0];
    type GetTemplateResponse = Awaited<ReturnType<FunctionsService["getMarketplaceTemplate"]>>;
    const result = await httpsCallable<
      GetTemplatePayload,
      GetTemplateResponse
    >(firebase.functions, "getMarketplaceTemplate")(payload);
    return result.data;
  },

  async addMarketplaceTemplate(payload) {
    type AddTemplatePayload = Parameters<FunctionsService["addMarketplaceTemplate"]>[0];
    type AddTemplateResponse = Awaited<ReturnType<FunctionsService["addMarketplaceTemplate"]>>;
    const result = await httpsCallable<
      AddTemplatePayload,
      AddTemplateResponse
    >(firebase.functions, "addMarketplaceTemplate")(payload);
    return result.data;
  },

  async submitMarketplaceTemplate(payload) {
    type SubmitTemplatePayload = Parameters<FunctionsService["submitMarketplaceTemplate"]>[0];
    type SubmitTemplateResponse = Awaited<ReturnType<FunctionsService["submitMarketplaceTemplate"]>>;
    const result = await httpsCallable<
      SubmitTemplatePayload,
      SubmitTemplateResponse
    >(firebase.functions, "submitMarketplaceTemplate")(payload);
    return result.data;
  },

  async publishMarketplaceTemplateVersion(payload) {
    type PublishVersionPayload = Parameters<FunctionsService["publishMarketplaceTemplateVersion"]>[0];
    type PublishVersionResponse = Awaited<ReturnType<FunctionsService["publishMarketplaceTemplateVersion"]>>;
    const result = await httpsCallable<
      PublishVersionPayload,
      PublishVersionResponse
    >(firebase.functions, "publishMarketplaceTemplateVersion")(payload);
    return result.data;
  },

  async submitMarketplaceReview(payload) {
    type SubmitReviewPayload = Parameters<FunctionsService["submitMarketplaceReview"]>[0];
    type SubmitReviewResponse = Awaited<ReturnType<FunctionsService["submitMarketplaceReview"]>>;
    const result = await httpsCallable<
      SubmitReviewPayload,
      SubmitReviewResponse
    >(firebase.functions, "submitMarketplaceReview")(payload);
    return result.data;
  },

  async getMarketplaceReviews(payload) {
    type GetReviewsPayload = Parameters<FunctionsService["getMarketplaceReviews"]>[0];
    type GetReviewsResponse = Awaited<ReturnType<FunctionsService["getMarketplaceReviews"]>>;
    const result = await httpsCallable<
      GetReviewsPayload,
      GetReviewsResponse
    >(firebase.functions, "getMarketplaceReviews")(payload);
    return result.data;
  },

  async registerAsContributor(payload) {
    type RegisterContributorPayload = Parameters<FunctionsService["registerAsContributor"]>[0];
    type RegisterContributorResponse = Awaited<ReturnType<FunctionsService["registerAsContributor"]>>;
    const result = await httpsCallable<
      RegisterContributorPayload,
      RegisterContributorResponse
    >(firebase.functions, "registerAsContributor")(payload);
    return result.data;
  },

  async getContributorStatus(payload) {
    type GetContributorStatusPayload = Parameters<FunctionsService["getContributorStatus"]>[0];
    type GetContributorStatusResponse = Awaited<ReturnType<FunctionsService["getContributorStatus"]>>;
    const result = await httpsCallable<
      GetContributorStatusPayload,
      GetContributorStatusResponse
    >(firebase.functions, "getContributorStatus")(payload);
    return result.data;
  },

  async createProductMetafieldDefinition(payload) {
    type CreateProductMetafieldDefinitionPayload = Parameters<FunctionsService["createProductMetafieldDefinition"]>[0];
    const result = await httpsCallable<CreateProductMetafieldDefinitionPayload, { id: string }>(
      firebase.functions,
      "createProductMetafieldDefinition",
    )(payload);
    return result.data;
  },

  async createContactMetafieldDefinition(payload) {
    type CreateContactMetafieldDefinitionPayload = Parameters<FunctionsService["createContactMetafieldDefinition"]>[0];
    const result = await httpsCallable<CreateContactMetafieldDefinitionPayload, { id: string }>(
      firebase.functions,
      "createContactMetafieldDefinition",
    )(payload);
    return result.data;
  },

  async interpretBusinessDescription(payload) {
    type InterpretPayload = Parameters<FunctionsService["interpretBusinessDescription"]>[0];
    type InterpretResponse = Awaited<ReturnType<FunctionsService["interpretBusinessDescription"]>>;
    const result = await httpsCallable<InterpretPayload, InterpretResponse>(
      firebase.functions,
      "interpretBusinessDescription",
    )(payload);
    return result.data;
  },

  async createCheckoutSession(payload) {
    type CreateCheckoutSessionPayload = Parameters<FunctionsService["createCheckoutSession"]>[0];
    const result = await httpsCallable<
      CreateCheckoutSessionPayload,
      { sessionId: string; url: string }
    >(firebase.functions, "createCheckoutSession")(payload);
    return result.data;
  },

  async createPortalSession(payload) {
    type CreatePortalSessionPayload = Parameters<FunctionsService["createPortalSession"]>[0];
    const result = await httpsCallable<
      CreatePortalSessionPayload,
      { url: string }
    >(firebase.functions, "createPortalSession")(payload);
    return result.data;
  },

  async getStripeBilling(payload) {
    type GetStripeBillingPayload = Parameters<FunctionsService["getStripeBilling"]>[0];
    type GetStripeBillingResponse = Awaited<ReturnType<FunctionsService["getStripeBilling"]>>;
    const result = await httpsCallable<
      GetStripeBillingPayload,
      GetStripeBillingResponse
    >(firebase.functions, "getStripeBilling")(payload);
    return result.data;
  },
};
