import { LoggerService, ProposalData, ProposalRepository, calculateTotals } from "../../core";


interface Dependencies {
  loggerService: LoggerService;
  proposalRepository: ProposalRepository;
}

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

export const handleCreateProposal = async (
  params: CreateProposalParams,
  dependencies: Dependencies,
): Promise<string> => {
  const { loggerService, proposalRepository } = dependencies;

  loggerService.info("createProposal:received", {
    orgId: params.orgId,
    customerId: params.customerId,
    title: params.title,
    itemCount: params.items.length,
    hasDescription: Boolean(params.description),
    hasNotes: Boolean(params.notes),
  });
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

  try {
    const proposalId = await proposalRepository.create({ data: proposalData });
    loggerService.info("createProposal:success", {
      proposalId,
      orgId: proposalData.orgId,
      customerId: proposalData.customerId,
      currency: proposalData.currency,
      subtotal,
      taxTotal,
      total,
    });
    return proposalId;
  } catch (error) {
    loggerService.error("createProposal:firestoreError", error, {
      orgId: proposalData.orgId,
      customerId: proposalData.customerId,
      title: proposalData.title,
      itemCount: proposalData.items.length,
      total,
    });
    throw error;
  }
};
