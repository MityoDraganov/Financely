import { ProposalData } from "../../entities/proposal";

export interface CreateProposalRequest {
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

export interface CreateProposalResponse {
  id: string;
}

export interface FunctionsService {
  createProposal(payload: CreateProposalRequest): Promise<CreateProposalResponse>;
}
