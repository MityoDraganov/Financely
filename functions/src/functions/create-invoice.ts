import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { handleCreateInvoice } from "../app/handle-create-invoice";
import { CreateInvoiceInput } from "../core/entities/invoice";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import { syncStripeInvoiceForInternalInvoice } from "../services/stripe-invoice-payment-sync";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

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
 *   status?: "unsent" | "sent" | "paid" | "cancelled", // "draft" supported for legacy payloads
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
    secrets: [stripeSecretKey],
    memory: "512MiB",
    minInstances: 1,
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

      if (!payload.orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID (orgId) is required"
        );
      }

      // Verify authentication and organization membership
      // Members can create invoices (owner/admin/member roles)
      await verifyAuthAndOrgMembership(request, payload.orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

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

      const startTime = Date.now();

      // Call application handler
      const invoiceId = await handleCreateInvoice(payload);

      loggerService.info("Invoice created successfully", { invoiceId });

      // Best effort Stripe payment sync for Connect-ready organizations.
      // Creation must never fail because Stripe sync can be retried later.
      try {
        const syncResult = await syncStripeInvoiceForInternalInvoice({
          stripeSecretKey: stripeSecretKey.value(),
          invoiceId,
        });
        if (syncResult.status === "sync_failed") {
          loggerService.warn("Invoice Stripe payment sync failed after create", {
            invoiceId,
            orgId: payload.orgId,
            error: syncResult.error,
          });
        }
      } catch (syncError) {
        loggerService.warn("Invoice Stripe payment sync threw after create", {
          invoiceId,
          orgId: payload.orgId,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
      }

      // Record usage event
      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: payload.orgId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.INVOICE_CREATE,
          metadata: {
            entityId: invoiceId,
            context: "api",
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        loggerService.warn("Failed to record usage event for invoice creation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      const invoiceNumber = (payload.data as any)?.invoiceNumber || invoiceId;
      await logAuditSuccessForRequest({
        request,
        operationName: "createInvoice",
        organizationId: payload.orgId,
        action: "invoice.created",
        resource: {
          type: "invoice",
          id: invoiceId,
          name: invoiceNumber,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "createInvoice",
        },
      });

      return { id: invoiceId };
    } catch (error: any) {
      loggerService.error("Failed to create invoice", {
        error: error.message,
        stack: error.stack,
      });

      const errorPayload = request.data as CreateInvoiceInput;
      await logAuditFailureForRequest({
        request,
        operationName: "createInvoice",
        organizationId: errorPayload?.orgId,
        action: "invoice.created",
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          source: "api",
          sourceDetails: "createInvoice",
        },
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
