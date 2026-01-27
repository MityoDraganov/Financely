import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateMetaobject } from "../app/handle-create-metaobject";
import { CreateMetaobjectInput } from "../core/entities/metaobject";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

export const createMetaobject = onCall<CreateMetaobjectInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const payload = request.data;

      if (!payload) {
        throw new HttpsError("invalid-argument", "Request payload is required");
      }

      if (!payload.organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      await verifyAuthAndOrgMembership(request, payload.organizationId, {
        requireOwnerOrAdmin: true,
      });

      if (!payload.definitionId) {
        throw new HttpsError("invalid-argument", "Definition ID is required");
      }

      loggerService.info("Creating metaobject", {
        organizationId: payload.organizationId,
        definitionId: payload.definitionId,
      });

      const metaobjectId = await handleCreateMetaobject(payload);

      loggerService.info("Metaobject created successfully", { metaobjectId });

      return { id: metaobjectId };
    } catch (error: any) {
      loggerService.error("Failed to create metaobject", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create metaobject: ${error.message}`
      );
    }
  }
);
