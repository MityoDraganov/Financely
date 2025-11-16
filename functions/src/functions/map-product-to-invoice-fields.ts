import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleMapProductToInvoiceFields } from "../app/handle-map-product-to-invoice-fields";
import { loggerService } from "../services/logger-service";

interface MapProductToInvoiceFieldsPayload {
  productId: string;
  templateId: string;
  organizationId: string;
  currentFormData: Record<string, unknown>;
}

interface MapProductToInvoiceFieldsResponse {
  mappedFields: Record<string, unknown>;
}

/**
 * Firebase Cloud Function for mapping product data to invoice fields using AI.
 *
 * This function uses AI to intelligently map product data to invoice template fields
 * based on field names, labels, and semantic meaning.
 *
 * Request payload structure:
 * {
 *   productId: string,
 *   templateId: string,
 *   organizationId: string,
 *   currentFormData: Record<string, unknown>
 * }
 *
 * Response: { mappedFields: Record<string, unknown> }
 */
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const mapProductToInvoiceFields = onCall<
  MapProductToInvoiceFieldsPayload,
  Promise<MapProductToInvoiceFieldsResponse>
>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
  },
  async (request) => {
    try {
      const payload = request.data;

      // Basic validation
      if (!payload) {
        throw new HttpsError(
          "invalid-argument",
          "Request payload is required"
        );
      }

      if (!payload.productId) {
        throw new HttpsError(
          "invalid-argument",
          "Product ID is required"
        );
      }

      if (!payload.templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      if (!payload.organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID is required"
        );
      }

      loggerService.info("Mapping product to invoice fields", {
        productId: payload.productId,
        templateId: payload.templateId,
        organizationId: payload.organizationId,
      });

      const startTime = Date.now();

      // Call application handler
      const result = await handleMapProductToInvoiceFields(payload);

      loggerService.info("Product mapped to invoice fields successfully", {
        productId: payload.productId,
        templateId: payload.templateId,
        mappedFieldCount: Object.keys(result.mappedFields).length,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      loggerService.error("Failed to map product to invoice fields", {
        error: error instanceof Error ? error.message : "Unknown error",
        productId: request.data?.productId,
        templateId: request.data?.templateId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to map product to invoice fields: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

