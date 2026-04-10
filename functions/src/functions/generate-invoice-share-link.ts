import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

type GenerateInvoiceShareLinkPayload = {
  invoiceId: string;
};

/**
 * Firebase Cloud Function for generating a shareable link for an invoice.
 *
 * This function:
 * 1. Fetches the invoice
 * 2. Generates a PDF if it doesn't exist yet (or uses existing PDF URL)
 * 3. Returns the public URL that can be shared
 *
 * Request payload:
 * {
 *   invoiceId: string  // The ID of the invoice to generate a share link for
 * }
 *
 * Response:
 * {
 *   url: string  // Public URL to share the invoice
 * }
 */
export const generateInvoiceShareLink = onCall<GenerateInvoiceShareLinkPayload, Promise<{ url: string }>>(
  {
    region: "us-central1",
    cors: true,
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

      loggerService.info("Generating invoice share link", { invoiceId });

      // Check if invoice already has a PDF URL
      const databaseService = getDatabaseService();
      const invoiceRepository = getInvoiceRepository(databaseService);
      const invoice = await invoiceRepository.get({ id: invoiceId });

      if (!invoice) {
        throw new HttpsError("not-found", `Invoice not found: ${invoiceId}`);
      }
      auditOrganizationId = invoice.orgId;

      // Keep for audit metadata only; handleRenderInvoicePdf decides whether to reuse or regenerate.
      const invoiceData = invoice.data as Record<string, unknown>;
      const existingPdfUrl = invoiceData.pdfUrl as string | undefined;
      auditInvoiceName = (invoiceData.invoiceNumber as string | undefined) || invoiceId;
      loggerService.info("Resolving invoice PDF for share link", {
        invoiceId,
        hasStoredPdfUrl: Boolean(existingPdfUrl),
      });
      const pdfUrl = await handleRenderInvoicePdf(invoiceId);

      loggerService.info("Share link generated successfully", {
        invoiceId,
        url: pdfUrl,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "generateInvoiceShareLink",
        organizationId: invoice.orgId,
        action: "access.granted",
        resource: {
          type: "invoice",
          id: invoiceId,
          name: auditInvoiceName,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "generateInvoiceShareLink",
          customFields: {
            hadStoredPdfUrl: Boolean(existingPdfUrl),
            url: pdfUrl,
          },
        },
      });

      return { url: pdfUrl };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      loggerService.error("Failed to generate invoice share link", {
        error: errorMessage,
        stack: errorStack,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "generateInvoiceShareLink",
        organizationId: auditOrganizationId,
        action: "access.granted",
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
          sourceDetails: "generateInvoiceShareLink",
        },
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to generate share link: ${errorMessage}`
      );
    }
  }
);
