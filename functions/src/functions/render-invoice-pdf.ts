import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

type RenderInvoicePdfPayload = {
  invoiceId: string;
};

/**
 * Firebase Cloud Function for rendering an invoice as PDF.
 *
 * This function:
 * 1. Fetches the invoice and its template
 * 2. Generates a PDF from the template and invoice data
 * 3. Saves the PDF to Firebase Storage
 * 4. Returns the public URL to access the PDF
 *
 * Request payload:
 * {
 *   invoiceId: string  // The ID of the invoice to render
 * }
 *
 * Response:
 * {
 *   url: string  // Public URL to access the generated PDF
 * }
 *
 * @example
 * const renderPdf = httpsCallable(functions, 'renderInvoicePdf');
 * const result = await renderPdf({ invoiceId: "invoice123" });
 * console.log("PDF URL:", result.data.url);
 */
export const renderInvoicePdf = onCall<RenderInvoicePdfPayload, Promise<{ url: string }>>(
  {
    region: "us-central1",
    cors: true,
    // Increase timeout and memory for PDF generation
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditInvoiceId: string | undefined;
    let auditInvoiceName: string | undefined;
    try {
      // TODO: Add authentication check when Clerk is integrated
      // if (!request.auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      const { invoiceId } = request.data;
      auditInvoiceId = invoiceId;

      // Validation
      if (!invoiceId || typeof invoiceId !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "Invoice ID is required and must be a string"
        );
      }

      loggerService.info("Rendering invoice PDF", { invoiceId });

      const databaseService = getDatabaseService();
      const invoiceRepository = getInvoiceRepository(databaseService);
      const invoice = await invoiceRepository.get({ id: invoiceId });
      if (invoice) {
        auditOrganizationId = invoice.orgId;
        const invoiceData = invoice.data as Record<string, unknown>;
        auditInvoiceName = (invoiceData.invoiceNumber as string | undefined) || invoiceId;
      }

      // Call application handler
      const url = await handleRenderInvoicePdf(invoiceId);

      loggerService.info("PDF rendered successfully", { invoiceId, url });

      await logAuditSuccessForRequest({
        request,
        operationName: "renderInvoicePdf",
        organizationId: auditOrganizationId,
        action: "invoice.pdf.generated",
        resource: auditInvoiceId
          ? {
              type: "invoice",
              id: auditInvoiceId,
              name: auditInvoiceName,
            }
          : undefined,
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "renderInvoicePdf",
          customFields: {
            url,
          },
        },
      });

      // Record usage event
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        if (invoice?.orgId) {
          await recordUsageEvent({
            orgId: invoice.orgId,
            userId: null, // PDF rendering may be triggered by public links
            featureId: USAGE_FEATURES.INVOICE_RENDER_PDF,
            metadata: {
              entityId: invoiceId,
              context: "api",
            },
          });
        }
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        loggerService.warn("Failed to record usage event for PDF rendering", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return { url };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      loggerService.error("Failed to render invoice PDF", {
        error: errorMessage,
        stack: errorStack,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "renderInvoicePdf",
        organizationId: auditOrganizationId,
        action: "invoice.pdf.generated",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditInvoiceId
          ? {
              type: "invoice",
              id: auditInvoiceId,
              name: auditInvoiceName,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "renderInvoicePdf",
        },
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to render PDF: ${errorMessage}`
      );
    }
  }
);
