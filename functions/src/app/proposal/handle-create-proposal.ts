import { firestore } from "../../infrastructure/firebase";
import { ProposalData, calculateTotals } from "../../core";

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

export const handleCreateProposal = async (params: CreateProposalParams): Promise<string> => {
  const { subtotal, taxTotal, total } = calculateTotals(params.items, params.vatRatePct);

  const proposalData: ProposalData = {
    orgId: params.orgId,
    customerId: params.customerId,
    title: params.title,
    description: params.description,
    status: "DRAFT",
    items: params.items,
    subtotal,
    taxTotal,
    total,
    currency: params.currency,
    terms: params.terms,
    notes: params.notes,
  };

  const docRef = await firestore.collection("proposals").add(proposalData);
  return docRef.id;
};
