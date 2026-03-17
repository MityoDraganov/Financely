import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateContactMetafieldDefinition } from "../app/handle-create-contact-metafield-definition";
import { CreateContactMetafieldDefinitionInput } from "../core/entities/contact-metafield";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

export const createContactMetafieldDefinition = onCall<CreateContactMetafieldDefinitionInput, Promise<{ id: string }>>(
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

      if (payload.type === "single_line_text_field_choice_list") {
        const selectOptions = payload.options?.selectOptions;
        if (!Array.isArray(selectOptions) || selectOptions.length === 0) {
          throw new HttpsError(
            "invalid-argument",
            "At least one select option is required when type is single_line_text_field_choice_list",
          );
        }

        const hasInvalidOption = selectOptions.some(
          (option) =>
            !option ||
            typeof option.label !== "string" ||
            option.label.trim().length === 0 ||
            typeof option.value !== "string" ||
            option.value.trim().length === 0,
        );
        if (hasInvalidOption) {
          throw new HttpsError(
            "invalid-argument",
            "Each select option must include non-empty label and value",
          );
        }

        const normalizedValues = selectOptions.map((option) => option.value.trim());
        if (new Set(normalizedValues).size !== normalizedValues.length) {
          throw new HttpsError("invalid-argument", "Select option values must be unique");
        }
      }

      if (payload.type === "date") {
        const selectionMode = payload.options?.dateConfig?.selectionMode ?? "single";
        const precision = payload.options?.dateConfig?.precision ?? "date";
        const validSelectionModes = new Set(["single", "period"]);
        const validPrecisions = new Set(["date", "month"]);

        if (!validSelectionModes.has(selectionMode)) {
          throw new HttpsError("invalid-argument", "Invalid date selection mode");
        }
        if (!validPrecisions.has(precision)) {
          throw new HttpsError("invalid-argument", "Invalid date precision");
        }
      }

      loggerService.info("Creating contact metafield definition", {
        organizationId: payload.organizationId,
        name: payload.name,
        type: payload.type,
        metaobjectDefinitionId: payload.metaobjectDefinitionId,
        selectOptionCount: payload.options?.selectOptions?.length || 0,
        dateConfig: payload.options?.dateConfig,
      });

      const definitionId = await handleCreateContactMetafieldDefinition(payload);

      loggerService.info("Contact metafield definition created successfully", { definitionId });

      return { id: definitionId };
    } catch (error: any) {
      loggerService.error("Failed to create contact metafield definition", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create contact metafield definition: ${error.message}`,
      );
    }
  },
);
