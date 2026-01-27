import { FunctionsService } from "@/core";
import { firebase } from "@/infrastructure/firebase";
import { httpsCallable } from "@firebase/functions";

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
    type UploadInvoiceFilePayload = Parameters<FunctionsService["uploadInvoiceFile"]>[0];
    const result = await httpsCallable<UploadInvoiceFilePayload, { jobId: string }>(
      firebase.functions,
      "uploadInvoiceFile",
    )(payload);
    return result.data;
  },

  async extractInvoiceData(payload) {
    type ExtractInvoiceDataPayload = Parameters<FunctionsService["extractInvoiceData"]>[0];
    const result = await httpsCallable<
      ExtractInvoiceDataPayload,
      Awaited<ReturnType<FunctionsService["extractInvoiceData"]>>
    >(firebase.functions, "extractInvoiceData")(payload);
    return result.data;
  },

  async generateTemplateFromExtraction(payload) {
    type GenerateTemplateFromExtractionPayload = Parameters<FunctionsService["generateTemplateFromExtraction"]>[0];
    const result = await httpsCallable<
      GenerateTemplateFromExtractionPayload,
      Awaited<ReturnType<FunctionsService["generateTemplateFromExtraction"]>>
    >(firebase.functions, "generateTemplateFromExtraction")(payload);
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
};