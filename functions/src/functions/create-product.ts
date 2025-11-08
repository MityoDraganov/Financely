import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateProduct } from "../app/handle-create-product";
import { CreateProductInput } from "../core/entities/product";
import { loggerService } from "../services/logger-service";

/**
 * Firebase Cloud Function for creating a product.
 *
 * This function accepts product data and creates a product record in the database.
 *
 * Request payload structure:
 * {
 *   organizationId: string,
 *   name: string,
 *   description?: string,
 *   price: number,
 *   currency: string,
 *   sku?: string,
 *   barcode?: string,
 *   stockQuantity?: number,
 *   trackInventory?: boolean,
 *   lowStockThreshold?: number,
 *   images?: string[],
 *   category?: string,
 *   tags?: string[],
 *   weight?: number,
 *   dimensions?: {
 *     length?: number,
 *     width?: number,
 *     height?: number,
 *     unit?: "cm" | "in" | "m"
 *   },
 *   status?: "active" | "inactive" | "archived",
 *   taxRate?: number,
 *   cost?: number
 * }
 *
 * Response: { id: string }
 *
 * @example
 * // Client call
 * const createProduct = httpsCallable(functions, 'createProduct');
 * const result = await createProduct({
 *   organizationId: "org123",
 *   name: "Premium Widget",
 *   description: "A high-quality widget",
 *   price: 99.99,
 *   currency: "USD",
 *   sku: "WID-001",
 *   stockQuantity: 100,
 *   trackInventory: true,
 *   images: ["https://example.com/image.jpg"]
 * });
 * console.log("Product ID:", result.data.id); // "product789"
 */
export const createProduct = onCall<CreateProductInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // TODO: Add authentication check when Clerk is integrated
      // if (!request.auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      const payload = request.data;

      // Basic validation
      if (!payload) {
        throw new HttpsError(
          "invalid-argument",
          "Request payload is required"
        );
      }

      if (!payload.organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID (organizationId) is required"
        );
      }

      if (!payload.name) {
        throw new HttpsError(
          "invalid-argument",
          "Product name is required"
        );
      }

      if (payload.price === undefined || payload.price < 0) {
        throw new HttpsError(
          "invalid-argument",
          "Price is required and must be non-negative"
        );
      }

      loggerService.info("Creating product", {
        organizationId: payload.organizationId,
        name: payload.name,
        price: payload.price,
      });

      // Call application handler
      const productId = await handleCreateProduct(payload);

      loggerService.info("Product created successfully", { productId });

      return { id: productId };
    } catch (error: any) {
      loggerService.error("Failed to create product", {
        error: error.message,
        stack: error.stack,
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to create product: ${error.message}`
      );
    }
  }
);

