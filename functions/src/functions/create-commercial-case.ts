import { onCall, HttpsError } from "firebase-functions/v2/https";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import {
  commercialCaseDataSchema,
  COMMERCIAL_CASE_EVENT_TYPES,
  COMMERCIAL_CASE_STAGES,
  type CommercialCaseData,
} from "../core/entities/commercial-case";
import { getDatabaseService } from "../services/database-service";
import { getCommercialCaseRepository } from "../repositories/commercial-case-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { appendCommercialCaseEvent } from "../services/commercial-case-lifecycle-service";

type CreateCommercialCaseInput = Omit<CommercialCaseData, "stage"> & {
  stage?: CommercialCaseData["stage"];
};

export const createCommercialCase = onCall<
  CreateCommercialCaseInput,
  Promise<{ id: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.organizationId) {
      throw new HttpsError("invalid-argument", "organizationId is required");
    }

    const auth = await verifyAuthAndOrgMembership(request, payload.organizationId);
    const databaseService = getDatabaseService();
    const commercialCaseRepository = getCommercialCaseRepository(databaseService);
    const leadRepository = getLeadRepository(databaseService);

    const normalizedPayload: CommercialCaseData = commercialCaseDataSchema.parse({
      ...payload,
      stage: payload.stage || COMMERCIAL_CASE_STAGES.INTAKE,
    });

    const commercialCaseId = await commercialCaseRepository.create({
      data: normalizedPayload,
    });

    if (!commercialCaseId) {
      throw new HttpsError("internal", "Failed to create commercial case");
    }

    if (normalizedPayload.leadId) {
      try {
        await leadRepository.update({
          id: normalizedPayload.leadId,
          data: {
            commercialCaseId,
          },
        });
      } catch (error) {
        loggerService.warn("Failed to attach lead to commercial case", {
          leadId: normalizedPayload.leadId,
          commercialCaseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await appendCommercialCaseEvent({
      organizationId: normalizedPayload.organizationId,
      commercialCaseId,
      type: COMMERCIAL_CASE_EVENT_TYPES.CASE_CREATED,
      actorUserId: auth.userId,
      toStage: normalizedPayload.stage,
      metadata: {
        title: normalizedPayload.title,
        leadId: normalizedPayload.leadId,
      },
    });

    return { id: commercialCaseId };
  },
);
