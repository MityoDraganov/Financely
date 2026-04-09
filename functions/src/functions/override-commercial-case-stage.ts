import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  COMMERCIAL_CASE_STAGES,
  CommercialCaseStage,
} from "../core/entities/commercial-case";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { transitionCommercialCaseStage } from "../services/commercial-case-lifecycle-service";

type OverrideCommercialCaseStageInput = {
  organizationId: string;
  commercialCaseId: string;
  toStage: CommercialCaseStage;
  overrideReason: string;
};

export const overrideCommercialCaseStage = onCall<
  OverrideCommercialCaseStageInput,
  Promise<{ id: string; fromStage: CommercialCaseStage; toStage: CommercialCaseStage }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (
      !payload?.organizationId ||
      !payload?.commercialCaseId ||
      !payload?.toStage ||
      !payload?.overrideReason
    ) {
      throw new HttpsError(
        "invalid-argument",
        "organizationId, commercialCaseId, toStage and overrideReason are required",
      );
    }

    if (!Object.values(COMMERCIAL_CASE_STAGES).includes(payload.toStage)) {
      throw new HttpsError("invalid-argument", "Invalid stage");
    }

    const auth = await verifyAuthAndOrgMembership(request, payload.organizationId, {
      requireOwnerOrAdmin: true,
    });

    const result = await transitionCommercialCaseStage({
      commercialCaseId: payload.commercialCaseId,
      organizationId: payload.organizationId,
      toStage: payload.toStage,
      actorUserId: auth.userId,
      overrideReason: payload.overrideReason,
      reason: payload.overrideReason,
    });

    return {
      id: payload.commercialCaseId,
      fromStage: result.fromStage,
      toStage: result.toStage,
    };
  },
);
