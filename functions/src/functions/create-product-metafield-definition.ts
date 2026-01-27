import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateProductMetafieldDefinition } from "../app/handle-create-product-metafield-definition";
import { CreateProductMetafieldDefinitionInput } from "../core/entities/product-metafield";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

export const createProductMetafieldDefinition = onCall<CreateProductMetafieldDefinitionInput, Promise<{ id: string }>>(
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

      if (!payload.type) {
        throw new HttpsError("invalid-argument", "Type is required");
      }

      if (payload.type === "metaobject_reference" && !payload.metaobjectDefinitionId) {
        throw new HttpsError("invalid-argument", "Metaobject definition ID is required when type is metaobject_reference");
      }

      loggerService.info("Creating product metafield definition", {
        organizationId: payload.organizationId,
        name: payload.name,
        type: payload.type,
        metaobjectDefinitionId: payload.metaobjectDefinitionId,
      });

      const definitionId = await handleCreateProductMetafieldDefinition(payload);

      loggerService.info("Product metafield definition created successfully", { definitionId });

      return { id: definitionId };
    } catch (error: any) {
      loggerService.error("Failed to create product metafield definition", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create product metafield definition: ${error.message}`
      );
    }
  }
);
