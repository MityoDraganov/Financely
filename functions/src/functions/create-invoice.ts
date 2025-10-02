import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateInvoice } from "../app/handle-create-invoice";
import { CreateInvoiceInput } from "../core/entities/invoice";
import { loggerService } from "../services/logger-service";

/**
 * Firebase Cloud Function for creating an invoice.
 * 
 * This function accepts dynamic invoice data based on templates and creates
 * an invoice record in the database.
 * 
 * Request payload structure:
 * {
 *   orgId: string,
 *   templateId: string,
 *   templateVersionId?: string,
 *   data: {
 *     // Dynamic structure based on template bindings
 *     // Example:
 *     seller: { name: "...", address: "...", taxIdVat: "..." },
 *     buyer: { name: "...", address: "...", taxIdVat: "..." },
 *     invoiceNumber: "INV-001",
 *     issueDate: "2025-01-01",
 *     dueDate: "2025-01-31",
 *     items: [
 *       { description: "Item 1", qty: 1, unitPrice: 100, total: 100 },
 *       ...
 *     ],
 *     subtotal: 200,
 *     vatTotal: 40,
 *     total: 240,
 *     ...any other fields from template
 *   },
 *   status?: "draft" | "sent" | "paid" | "cancelled",
 *   notes?: string
 * }
 * 
 * Response: string (invoice ID)
 * 
 * @example
 * // Client call
 * const createInvoice = httpsCallable(functions, 'createInvoice');
 * const result = await createInvoice({
 *   orgId: "org123",
 *   templateId: "template456",
 *   data: {
 *     seller: { name: "Acme Inc", address: "123 Main St", taxIdVat: "US123456" },
 *     buyer: { name: "Customer Ltd", address: "456 Oak Ave", taxIdVat: "US789012" },
 *     invoiceNumber: "INV-001",
 *     issueDate: "2025-01-01",
 *     dueDate: "2025-01-31",
 *     items: [
 *       { description: "Consulting", qty: 10, unitPrice: 150, total: 1500 }
 *     ],
 *     subtotal: 1500,
 *     vatTotal: 300,
 *     total: 1800
 *   }
 * });
 * console.log("Invoice ID:", result.data); // "invoice789"
 */
export const createInvoice = onCall<CreateInvoiceInput, Promise<{ id: string }>>(
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

      if (!payload.orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID (orgId) is required"
        );
      }

      if (!payload.templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID (templateId) is required"
        );
      }

      if (!payload.data || typeof payload.data !== "object") {
        throw new HttpsError(
          "invalid-argument",
          "Invoice data is required and must be an object"
        );
      }

      loggerService.info("Creating invoice", {
        orgId: payload.orgId,
        templateId: payload.templateId,
        hasData: !!payload.data,
      });

      // Call application handler
      const invoiceId = await handleCreateInvoice(payload);

      loggerService.info("Invoice created successfully", { invoiceId });

      return { id: invoiceId };
    } catch (error: any) {
      loggerService.error("Failed to create invoice", {
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
        `Failed to create invoice: ${error.message}`
      );
    }
  }
);

