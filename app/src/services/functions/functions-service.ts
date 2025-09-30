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
    const result = await httpsCallable<CreateInvoicePayload, string>(
      firebase.functions,
      "createInvoice",
    )(payload);
    return { id: result.data };
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
};