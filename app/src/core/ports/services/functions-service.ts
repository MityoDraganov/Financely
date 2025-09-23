

export interface DeleteResponse {
  deleted: boolean;
  error?: string;
}

export interface FunctionsService {
  createProposal(payload: {
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
  }): Promise<{ id: string }>;
}