import { onCall } from "firebase-functions/v2/https";
import { handleCreateProposal } from "../app/proposal/handle-create-proposal";
import { serviceHost } from "../services";
import { repositoryHost } from "../repositories";

interface CreateProposalRequest {
  orgId: string;
  customerId: string;
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
  vatRatePct?: number;
}

interface CreateProposalResponse {
  id: string;
}

export const createProposal = onCall({ invoker: "public", ingressSettings: "ALLOW_ALL" }, async (request) => {
  const { data } = request;
  const loggerService = serviceHost.getLoggerService();
  const databaseService = serviceHost.getDatabaseService();
  const proposalRepository = repositoryHost.getProposalRepository(databaseService);
  try {
    const requestData = data as CreateProposalRequest;
    loggerService.info("createProposal:functionReceived", {
      orgId: requestData.orgId,
      customerId: requestData.customerId,
      title: requestData.title,
      currency: requestData.currency,
      itemCount: requestData.items.length,
    });
    const proposalId = await handleCreateProposal(requestData, { loggerService, proposalRepository });
    loggerService.info("createProposal:functionSuccess", { proposalId });
    const response: CreateProposalResponse = { id: proposalId };
    return response;
  } catch (error) {
    loggerService.error("createProposal:functionError", error);
    throw new Error("Failed to create proposal");
  }
});


