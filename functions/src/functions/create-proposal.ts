import { onCall } from "firebase-functions/v2/https";
import { handleCreateProposal } from "../app/proposal/handle-create-proposal";

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
  try {
    const proposalId = await handleCreateProposal(data as CreateProposalRequest);
    const response: CreateProposalResponse = { id: proposalId };
    return response;
  } catch (error) {
    console.error("Error creating proposal:", error);
    throw new Error("Failed to create proposal");
  }
});


