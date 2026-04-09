import { HttpsError } from "firebase-functions/v2/https";
import {
  canTransitionCommercialCaseStage,
  COMMERCIAL_CASE_EVENT_TYPES,
  COMMERCIAL_CASE_STAGES,
  CommercialCase,
  CommercialCaseEventData,
  CommercialCaseStage,
} from "../core/entities/commercial-case";
import { getDatabaseService } from "./database-service";
import {
  getCommercialCaseEventRepository,
  getCommercialCaseRepository,
} from "../repositories/commercial-case-repository";

type StageTransitionPayload = {
  commercialCaseId: string;
  organizationId: string;
  toStage: CommercialCaseStage;
  actorUserId?: string;
  reason?: string;
  overrideReason?: string;
};

export type CommercialCaseStageTransitionResult = {
  commercialCase: CommercialCase;
  fromStage: CommercialCaseStage;
  toStage: CommercialCaseStage;
};

export async function getCommercialCaseOrThrow(
  commercialCaseId: string,
  organizationId?: string,
): Promise<CommercialCase> {
  const databaseService = getDatabaseService();
  const commercialCaseRepository = getCommercialCaseRepository(databaseService);
  const commercialCase = await commercialCaseRepository.get({ id: commercialCaseId });

  if (!commercialCase) {
    throw new HttpsError("not-found", "Commercial case not found");
  }

  if (organizationId && commercialCase.organizationId !== organizationId) {
    throw new HttpsError(
      "permission-denied",
      "Commercial case does not belong to this organization",
    );
  }

  return commercialCase;
}

export async function appendCommercialCaseEvent(
  event: CommercialCaseEventData,
): Promise<string> {
  const databaseService = getDatabaseService();
  const eventRepository = getCommercialCaseEventRepository(databaseService);
  return eventRepository.create({ data: event });
}

const buildStageMetadataPatch = (
  targetStage: CommercialCaseStage,
  reason?: string,
): Partial<CommercialCase> => {
  const nowIso = new Date().toISOString();
  const patch: Partial<CommercialCase> = {
    stage: targetStage,
  };

  if (targetStage === COMMERCIAL_CASE_STAGES.WON) {
    patch.wonAt = nowIso;
  }
  if (targetStage === COMMERCIAL_CASE_STAGES.LOST) {
    patch.lostAt = nowIso;
    patch.lostReason = reason;
  }
  if (targetStage === COMMERCIAL_CASE_STAGES.INVOICED) {
    patch.invoicedAt = nowIso;
  }
  if (targetStage === COMMERCIAL_CASE_STAGES.PAID) {
    patch.paidAt = nowIso;
  }

  return patch;
};

export async function transitionCommercialCaseStage(
  payload: StageTransitionPayload,
): Promise<CommercialCaseStageTransitionResult> {
  const {
    commercialCaseId,
    organizationId,
    toStage,
    actorUserId,
    reason,
    overrideReason,
  } = payload;

  const commercialCase = await getCommercialCaseOrThrow(
    commercialCaseId,
    organizationId,
  );
  const fromStage = commercialCase.stage;
  const isOverride = !canTransitionCommercialCaseStage(fromStage, toStage);

  if (isOverride && (!overrideReason || !overrideReason.trim())) {
    throw new HttpsError(
      "invalid-argument",
      "overrideReason is required for out-of-sequence stage transitions",
    );
  }

  if (!isOverride && toStage === COMMERCIAL_CASE_STAGES.LOST && !reason?.trim()) {
    throw new HttpsError("invalid-argument", "reason is required for LOST stage");
  }

  const databaseService = getDatabaseService();
  const commercialCaseRepository = getCommercialCaseRepository(databaseService);
  const updatePatch: Partial<CommercialCase> = {
    ...buildStageMetadataPatch(toStage, reason || overrideReason),
  };

  await commercialCaseRepository.update({
    id: commercialCaseId,
    data: updatePatch,
  });

  await appendCommercialCaseEvent({
    organizationId,
    commercialCaseId,
    type: COMMERCIAL_CASE_EVENT_TYPES.CASE_STAGE_CHANGED,
    actorUserId,
    fromStage,
    toStage,
    reason: isOverride ? overrideReason : reason,
    metadata: {
      overrideUsed: isOverride,
    },
  });

  if (isOverride) {
    await appendCommercialCaseEvent({
      organizationId,
      commercialCaseId,
      type: COMMERCIAL_CASE_EVENT_TYPES.CASE_OVERRIDE_USED,
      actorUserId,
      fromStage,
      toStage,
      reason: overrideReason,
      metadata: {
        overrideReason,
      },
    });
  }

  const updatedCase = await getCommercialCaseOrThrow(commercialCaseId, organizationId);
  return {
    commercialCase: updatedCase,
    fromStage,
    toStage,
  };
}

export async function emitProposalLinkedToCaseEvent(payload: {
  organizationId: string;
  commercialCaseId: string;
  proposalId: string;
  actorUserId?: string;
}): Promise<void> {
  await appendCommercialCaseEvent({
    organizationId: payload.organizationId,
    commercialCaseId: payload.commercialCaseId,
    type: COMMERCIAL_CASE_EVENT_TYPES.PROPOSAL_LINKED,
    actorUserId: payload.actorUserId,
    metadata: {
      proposalId: payload.proposalId,
    },
  });
}

export async function emitInvoiceLinkedToCaseEvent(payload: {
  organizationId: string;
  commercialCaseId: string;
  invoiceId: string;
  actorUserId?: string;
}): Promise<void> {
  await appendCommercialCaseEvent({
    organizationId: payload.organizationId,
    commercialCaseId: payload.commercialCaseId,
    type: COMMERCIAL_CASE_EVENT_TYPES.INVOICE_LINKED,
    actorUserId: payload.actorUserId,
    metadata: {
      invoiceId: payload.invoiceId,
    },
  });
}

export async function emitInvoicePaidCaseEvent(payload: {
  organizationId: string;
  commercialCaseId: string;
  invoiceId: string;
  actorUserId?: string;
}): Promise<void> {
  await appendCommercialCaseEvent({
    organizationId: payload.organizationId,
    commercialCaseId: payload.commercialCaseId,
    type: COMMERCIAL_CASE_EVENT_TYPES.INVOICE_PAID,
    actorUserId: payload.actorUserId,
    metadata: {
      invoiceId: payload.invoiceId,
    },
  });
}
