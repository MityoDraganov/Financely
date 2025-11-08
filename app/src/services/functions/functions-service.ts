import { FunctionsService } from "@/core";
import { firebase } from "@/infrastructure/firebase";
import { httpsCallable } from "@firebase/functions";

export const functionsService: FunctionsService = {
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

  async addCustomDomain(payload) {
    type AddCustomDomainPayload = Parameters<
      FunctionsService["addCustomDomain"]
    >[0];
    const result = await httpsCallable<
      AddCustomDomainPayload,
      { success: boolean; customDomain: string }
    >(firebase.functions, "addCustomDomain")(payload);
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

  async createProduct(payload) {
    type CreateProductPayload = Parameters<FunctionsService["createProduct"]>[0];
    const result = await httpsCallable<CreateProductPayload, { id: string }>(
      firebase.functions,
      "createProduct",
    )(payload);
    return result.data;
  },
};