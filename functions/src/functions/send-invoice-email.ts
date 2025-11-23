import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { ResendEmailService } from "../services/resend-email-service";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import {
  getEmailBrandingConfig,
  generateInvoiceEmailHTML,
} from "../utils/branding-email";
import { getStorage } from "firebase-admin/storage";
import { formatInvoiceAmount } from "../utils/invoice-helpers";

// Define secrets using Firebase Functions Secret Manager
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendInvoiceEmailPayload {
  invoiceId: string;
  toEmail: string;
}

/**
 * Firebase Cloud Function for sending an invoice via email.
 *
 * This function:
 * 1. Fetches the invoice and its template
 * 2. Generates a PDF from the template and invoice data
 * 3. Sends the PDF as an attachment via email
 * 4. Returns success status
 *
 * Request payload:
 * {
 *   invoiceId: string  // The ID of the invoice to send
 *   toEmail: string    // The recipient email address
 * }
 *
 * Response:
 * {
 *   sent: boolean  // Whether the email was sent successfully
 * }
 */
export const sendInvoiceEmail = onCall<SendInvoiceEmailPayload, Promise<{ sent: boolean }>>(
  {
    region: "us-central1",
    cors: true,
    secrets: [resendApiKey, resendFromEmail, resendFromName],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    try {
      // TODO: Add authentication check when Clerk is integrated
      // if (!request.auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      const { invoiceId, toEmail } = request.data;

      // Validation
      if (!invoiceId) {
        throw new HttpsError("invalid-argument", "invoiceId is required");
      }
      if (!toEmail) {
        throw new HttpsError("invalid-argument", "toEmail is required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(toEmail)) {
        throw new HttpsError("invalid-argument", "Invalid email address format");
      }

      // Fetch invoice
      const databaseService = getDatabaseService();
      const invoiceRepository = getInvoiceRepository(databaseService);
      const invoice = await invoiceRepository.get({ id: invoiceId });
      if (!invoice) {
        throw new HttpsError("not-found", `Invoice not found: ${invoiceId}`);
      }

      // Fetch organization for branding
      let organization = null;
      let brandingConfig = null;
      if (invoice.orgId) {
        const organizationRepository = getOrganizationRepository(databaseService);
        organization = await organizationRepository.get({ id: invoice.orgId });
        if (organization) {
          brandingConfig = getEmailBrandingConfig(organization);
        }
      }

      // Generate PDF
      logger.info("Generating PDF for invoice", { invoiceId });
      const pdfUrl = await handleRenderInvoicePdf(invoiceId);

      // Download PDF from storage to attach to email
      const storage = getStorage();
      const bucket = storage.bucket();
      
      // Extract the path from the URL
      // PDF URL format: https://storage.googleapis.com/{bucketName}/{orgId}/{invoiceId}.pdf
      let pdfPath: string;
      if (pdfUrl.startsWith("gs://")) {
        // gs:// format
        pdfPath = pdfUrl.replace(`gs://${bucket.name}/`, "");
      } else if (pdfUrl.includes("storage.googleapis.com")) {
        // Public URL format: https://storage.googleapis.com/{bucketName}/{path}
        const urlParts = pdfUrl.split("storage.googleapis.com/");
        if (urlParts.length > 1) {
          pdfPath = urlParts[1].split("?")[0].replace(`${bucket.name}/`, "");
        } else {
          throw new Error("Could not extract PDF path from URL");
        }
      } else if (pdfUrl.includes("/o/")) {
        // Firebase Storage URL format
        const urlParts = pdfUrl.split("/o/");
        if (urlParts.length > 1) {
          pdfPath = decodeURIComponent(urlParts[1].split("?")[0]);
        } else {
          throw new Error("Could not extract PDF path from URL");
        }
      } else {
        // Try to extract from bucket name and path
        const bucketName = bucket.name;
        const urlMatch = pdfUrl.match(new RegExp(`${bucketName}/([^?]+)`));
        if (urlMatch) {
          pdfPath = urlMatch[1];
        } else {
          // Fallback: assume the URL contains the path after the bucket name
          const parts = pdfUrl.split(`${bucketName}/`);
          if (parts.length > 1) {
            pdfPath = parts[1].split("?")[0];
          } else {
            throw new Error(`Could not extract PDF path from URL: ${pdfUrl}`);
          }
        }
      }

      const file = bucket.file(pdfPath);
      const [pdfBuffer] = await file.download();

      // Extract invoice data for email
      const invoiceData = invoice.data as Record<string, unknown>;
      const buyer = (invoiceData.buyer || invoiceData.customer) as Record<string, unknown> | undefined;
      
      const invoiceNumber = invoiceData.invoiceNumber as string || invoice.id;
      const customerName = (buyer?.name as string) || "Customer";
      const dueDate = invoiceData.dueDate as string || "";
      const description = invoiceData.description as string || "";

      // Format amount with currency using utility function
      const formattedAmount = formatInvoiceAmount(invoice);

      // Format due date
      const formattedDueDate = dueDate
        ? new Date(dueDate).toLocaleDateString()
        : "N/A";

      // Generate share link (if needed, you can implement generateInvoiceShareLink separately)
      const invoiceUrl = pdfUrl; // Use PDF URL as invoice link for now

      // Initialize email service with secrets
      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      // Generate email content
      let subject: string;
      let html: string;
      let text: string;

      if (brandingConfig) {
        // Use branded email template
        subject = `Invoice #${invoiceNumber} - Payment Due`;
        html = generateInvoiceEmailHTML(
          {
            invoiceNumber,
            customerName,
            amount: formattedAmount,
            dueDate: formattedDueDate,
            description,
            invoiceUrl,
          },
          brandingConfig
        );
        text = `Invoice #${invoiceNumber} - Amount: ${formattedAmount}, Due: ${formattedDueDate}`;
      } else {
        // Fallback to non-branded template
        subject = `Invoice #${invoiceNumber} - Payment Due`;
        html = `
          <h1>Invoice #${invoiceNumber}</h1>
          <p>Hello ${customerName},</p>
          <p>Your invoice is ready for payment.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Invoice Details</h3>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Due Date:</strong> ${formattedDueDate}</p>
            ${description ? `<p><strong>Description:</strong> ${description}</p>` : ""}
          </div>
          ${invoiceUrl ? `<p><a href="${invoiceUrl}">View Invoice</a></p>` : ""}
        `;
        text = `Invoice #${invoiceNumber} - Amount: ${formattedAmount}, Due: ${formattedDueDate}`;
      }

      // Always use verified Resend email address to avoid domain verification issues
      // Use organization name for branding in the from name
      const fromEmail = resendFromEmail.value();
      const fromName = brandingConfig?.emailFromName || resendFromName.value();

      // Send email with PDF attachment
      const result = await emailService.sendEmail({
        to: { email: toEmail, name: customerName },
        from: { email: fromEmail, name: fromName },
        subject,
        html,
        text,
        attachments: [
          {
            filename: `invoice-${invoiceNumber}.pdf`,
            content: pdfBuffer.toString("base64"),
            contentType: "application/pdf",
          },
        ],
      });

      logger.info("Invoice email sent successfully", {
        invoiceId,
        toEmail,
        subject,
        messageId: result.messageId,
        success: result.success,
      });

      return {
        sent: result.success,
      };
    } catch (error) {
      logger.error("Error sending invoice email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send invoice email");
    }
  }
);

