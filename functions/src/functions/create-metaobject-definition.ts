import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateMetaobjectDefinition } from "../app/handle-create-metaobject-definition";
import { CreateMetaobjectDefinitionInput } from "../core/entities/metaobject";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

export const createMetaobjectDefinition = onCall<CreateMetaobjectDefinitionInput, Promise<{ id: string }>>(
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

      if (!payload.name) {
        throw new HttpsError("invalid-argument", "Name is required");
      }

      if (!payload.fieldDefinitions || payload.fieldDefinitions.length === 0) {
        throw new HttpsError("invalid-argument", "At least one field definition is required");
      }

      loggerService.info("Creating metaobject definition", {
        organizationId: payload.organizationId,
        name: payload.name,
      });

      const definitionId = await handleCreateMetaobjectDefinition(payload);

      loggerService.info("Metaobject definition created successfully", { definitionId });

      return { id: definitionId };
    } catch (error: any) {
      loggerService.error("Failed to create metaobject definition", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create metaobject definition: ${error.message}`
      );
    }
  }
);
