import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import { loggerService } from "../services/logger-service";

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
    try {
      // TODO: Add authentication check when Clerk is integrated
      // if (!request.auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      const { invoiceId } = request.data;

      // Validation
      if (!invoiceId || typeof invoiceId !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "Invoice ID is required and must be a string"
        );
      }

      loggerService.info("Rendering invoice PDF", { invoiceId });

      // Call application handler
      const url = await handleRenderInvoicePdf(invoiceId);

      loggerService.info("PDF rendered successfully", { invoiceId, url });

      return { url };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      loggerService.error("Failed to render invoice PDF", {
        error: errorMessage,
        stack: errorStack,
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

