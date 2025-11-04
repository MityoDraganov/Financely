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
};