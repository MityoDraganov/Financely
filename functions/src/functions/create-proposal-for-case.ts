import { onCall, HttpsError } from "firebase-functions/v2/https";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import {
  calculateTotals,
  proposalDataSchema,
  PROPOSAL_STATUSES,
  type ProposalItem,
} from "../core/entities/proposal";
import {
  canTransitionCommercialCaseStage,
  COMMERCIAL_CASE_STAGES,
} from "../core/entities/commercial-case";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import {
  emitProposalLinkedToCaseEvent,
  getCommercialCaseOrThrow,
  transitionCommercialCaseStage,
} from "../services/commercial-case-lifecycle-service";

type CreateProposalForCaseInput = {
  organizationId: string;
  commercialCaseId: string;
  leadId?: string;
  title: string;
  description?: string;
  items: ProposalItem[];
  currency: string;
  terms?: string;
  notes?: string;
  aiGenerated?: boolean;
  vatRatePct?: number;
};

export const createProposalForCase = onCall<
  CreateProposalForCaseInput,
  Promise<{ id: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.organizationId || !payload?.commercialCaseId) {
      throw new HttpsError(
        "invalid-argument",
        "organizationId and commercialCaseId are required",
      );
    }

    const auth = await verifyAuthAndOrgMembership(request, payload.organizationId);
    const commercialCase = await getCommercialCaseOrThrow(
      payload.commercialCaseId,
      payload.organizationId,
    );
    const totals = calculateTotals(payload.items || [], payload.vatRatePct);

    const proposalData = proposalDataSchema.parse({
      organizationId: payload.organizationId,
      commercialCaseId: payload.commercialCaseId,
      leadId: payload.leadId || commercialCase.leadId,
      title: payload.title,
      description: payload.description,
      status: PROPOSAL_STATUSES.CREATED,
      items: payload.items,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      currency: payload.currency || commercialCase.currency || "USD",
      terms: payload.terms,
      notes: payload.notes,
      aiGenerated: payload.aiGenerated ?? false,
      isIncomplete: false,
    });

    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const proposalId = await proposalRepository.create({ data: proposalData });

    if (!proposalId) {
      throw new HttpsError("internal", "Failed to create proposal");
    }

    if (
      canTransitionCommercialCaseStage(
        commercialCase.stage,
        COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT,
      ) &&
      commercialCase.stage !== COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT
    ) {
      try {
        await transitionCommercialCaseStage({
          organizationId: payload.organizationId,
          commercialCaseId: payload.commercialCaseId,
          toStage: COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT,
          actorUserId: auth.userId,
          reason: "Proposal drafted",
        });
      } catch (error) {
        loggerService.warn("Failed to auto-advance case to PROPOSAL_DRAFT", {
          commercialCaseId: payload.commercialCaseId,
          proposalId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await emitProposalLinkedToCaseEvent({
      organizationId: payload.organizationId,
      commercialCaseId: payload.commercialCaseId,
      proposalId,
      actorUserId: auth.userId,
    });

    return { id: proposalId };
  },
);
