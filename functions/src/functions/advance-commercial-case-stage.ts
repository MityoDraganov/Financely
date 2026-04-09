import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  COMMERCIAL_CASE_STAGES,
  CommercialCaseStage,
  terminalCommercialCaseStages,
} from "../core/entities/commercial-case";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { transitionCommercialCaseStage } from "../services/commercial-case-lifecycle-service";

type AdvanceCommercialCaseStageInput = {
  organizationId: string;
  commercialCaseId: string;
  toStage: CommercialCaseStage;
  reason?: string;
};

export const advanceCommercialCaseStage = onCall<
  AdvanceCommercialCaseStageInput,
  Promise<{ id: string; fromStage: CommercialCaseStage; toStage: CommercialCaseStage }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.organizationId || !payload?.commercialCaseId || !payload?.toStage) {
      throw new HttpsError(
        "invalid-argument",
        "organizationId, commercialCaseId and toStage are required",
      );
    }

    if (!Object.values(COMMERCIAL_CASE_STAGES).includes(payload.toStage)) {
      throw new HttpsError("invalid-argument", "Invalid stage");
    }

    if (
      payload.toStage === COMMERCIAL_CASE_STAGES.LOST &&
      (!payload.reason || !payload.reason.trim())
    ) {
      throw new HttpsError(
        "invalid-argument",
        "reason is required when moving case to LOST",
      );
    }

    const auth = await verifyAuthAndOrgMembership(request, payload.organizationId);
    const result = await transitionCommercialCaseStage({
      commercialCaseId: payload.commercialCaseId,
      organizationId: payload.organizationId,
      toStage: payload.toStage,
      actorUserId: auth.userId,
      reason: payload.reason,
    });

    if (
      terminalCommercialCaseStages.has(result.fromStage) &&
      result.fromStage !== result.toStage
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Terminal stages cannot be advanced without override",
      );
    }

    return {
      id: payload.commercialCaseId,
      fromStage: result.fromStage,
      toStage: result.toStage,
    };
  },
);
