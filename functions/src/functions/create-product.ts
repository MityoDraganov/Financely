import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateProduct } from "../app/handle-create-product";
import { CreateProductInput } from "../core/entities/product";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService } from "../services/audit-log-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

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

      // Verify authentication and organization membership
      // Only owner/admin can create products
      await verifyAuthAndOrgMembership(request, payload.organizationId, {
        requireOwnerOrAdmin: true,
      });

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

      const startTime = Date.now();

      // Call application handler
      const productId = await handleCreateProduct(payload);

      loggerService.info("Product created successfully", { productId });

      // Automatically create audit log entry
      try {
        const userContext = await extractUserContextFromRequest(request);
        if (userContext) {
          const databaseService = getDatabaseService();
          const auditLogRepository = getAuditLogRepository(databaseService);
          const auditLogService = getAuditLogService(auditLogRepository);

          await auditLogService.logSuccess(
            payload.organizationId,
            "product.created",
            userContext,
            {
              resource: {
                type: "product",
                id: productId,
                name: payload.name,
              },
              durationMs: Date.now() - startTime,
              metadata: {
                source: "api",
                sourceDetails: "createProduct",
              },
            }
          );
        }
      } catch (auditError) {
        // Don't fail the operation if audit logging fails
        loggerService.warn("Failed to create audit log for product creation", {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      return { id: productId };
    } catch (error: any) {
      loggerService.error("Failed to create product", {
        error: error.message,
        stack: error.stack,
      });

      // Log failure to audit log
      try {
        const userContext = await extractUserContextFromRequest(request);
        const errorPayload = request.data as CreateProductInput;
        if (userContext && errorPayload?.organizationId) {
          const databaseService = getDatabaseService();
          const auditLogRepository = getAuditLogRepository(databaseService);
          const auditLogService = getAuditLogService(auditLogRepository);

          await auditLogService.logFailure(
            errorPayload.organizationId,
            "product.created",
            userContext,
            error,
            {
              metadata: {
                source: "api",
                sourceDetails: "createProduct",
              },
            }
          );
        }
      } catch (auditError) {
        // Don't fail if audit logging fails
        loggerService.warn("Failed to create audit log for product creation failure", {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

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

