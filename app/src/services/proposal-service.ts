import { FunctionsService } from "@/core/ports/services/functions-service";

export interface CreateProposalParams {
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

export const createProposalService = (functionsService: FunctionsService) => {
  return {
    async createProposal(params: CreateProposalParams): Promise<string> {
      const result = await functionsService.createProposal({
        orgId: params.orgId,
        customerId: params.customerId,
        title: params.title,
        description: params.description,
        items: params.items,
        currency: params.currency,
        terms: params.terms,
        notes: params.notes,
        vatRatePct: params.vatRatePct,
      });

      return result.id;
    },
  };
};
