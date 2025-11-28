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
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { getGenericRepository } from "../repositories/generic-repository";
import { DatabaseCollection } from "../repositories/config";
import type { InvoiceDataValue } from "../core";

// Email template types (from Realtime Database)
interface EmailTemplate {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  preheader?: string;
  htmlContent: string;
  placeholders?: Array<{ id: string; key: string; label?: string; description?: string }>;
}

// Email template mapping types (from Firestore)
interface EmailTemplateMapping {
  id: string;
  orgId: string;
  emailTemplateId: string;
  entityTemplateId: string;
  entityType: string;
  mappings: Record<string, string>;
}

// Define secrets using Firebase Functions Secret Manager
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendInvoiceEmailPayload {
  invoiceId: string;
  toEmail: string;
  emailTemplateId?: string;
}

/**
 * Get a value from invoice data using a binding path
 */
function getBindingValue(
  data: Record<string, InvoiceDataValue>,
  binding: string
): InvoiceDataValue | undefined {
  const parts = binding.split(".");
  let current: InvoiceDataValue = data;

  for (const part of parts) {
    if (current == null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Format a value for display in email
 */
function formatValueForEmail(value: InvoiceDataValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "object" && item !== null) {
        return JSON.stringify(item);
      }
      return String(item);
    }).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Replace placeholders in email template HTML with invoice values
 */
function replacePlaceholdersInTemplate(
  html: string,
  subject: string,
  preheader: string | undefined,
  mappings: Record<string, string>,
  invoiceData: Record<string, InvoiceDataValue>
): { html: string; subject: string; preheader: string } {
  let processedHtml = html;
  let processedSubject = subject;
  let processedPreheader = preheader || "";

  // Replace placeholders in HTML, subject, and preheader
  for (const [placeholderKey, bindingPath] of Object.entries(mappings)) {
    const placeholderPattern = new RegExp(`\\{\\{${placeholderKey}\\}\\}`, "g");
    const value = formatValueForEmail(getBindingValue(invoiceData, bindingPath));
    
    processedHtml = processedHtml.replace(placeholderPattern, value);
    processedSubject = processedSubject.replace(placeholderPattern, value);
    processedPreheader = processedPreheader.replace(placeholderPattern, value);
  }

  return {
    html: processedHtml,
    subject: processedSubject,
    preheader: processedPreheader,
  };
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

      const { invoiceId, toEmail, emailTemplateId } = request.data;

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
      const invoiceData = invoice.data as Record<string, InvoiceDataValue>;
      const buyer = (invoiceData.buyer || invoiceData.customer) as Record<string, InvoiceDataValue> | undefined;
      
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
      let subject = `Invoice #${invoiceNumber} - Payment Due`;
      let html = "";
      let text = `Invoice #${invoiceNumber} - Amount: ${formattedAmount}, Due: ${formattedDueDate}`;

      // Check if custom email template is provided
      if (emailTemplateId && invoice.templateId) {
        try {
          // Fetch email template from Realtime Database
          const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
            "emailTemplates",
            emailTemplateId
          );

          if (emailTemplate) {
            // Fetch email template mapping from Firestore
            const databaseService = getDatabaseService();
            const emailTemplateMappingRepository = getGenericRepository<EmailTemplateMapping, Omit<EmailTemplateMapping, "id">>(
              () => DatabaseCollection.EMAIL_TEMPLATE_MAPPINGS,
              databaseService
            );

            const mappings = await emailTemplateMappingRepository.getAll({
              queryConstraints: [
                { field: "orgId", operator: "==", value: invoice.orgId },
                { field: "emailTemplateId", operator: "==", value: emailTemplateId },
                { field: "entityTemplateId", operator: "==", value: invoice.templateId },
                { field: "entityType", operator: "==", value: "invoice" },
              ],
            });

            const mapping = Array.isArray(mappings) ? mappings[0] : null;

            if (mapping && mapping.mappings) {
              // Use custom email template with mappings
              const templateHtml = emailTemplate.htmlContent || "";
              const templateSubject = emailTemplate.subject || `Invoice #${invoiceNumber}`;
              const templatePreheader = emailTemplate.preheader || "";

              // Replace placeholders with invoice values
              const processed = replacePlaceholdersInTemplate(
                templateHtml,
                templateSubject,
                templatePreheader,
                mapping.mappings,
                invoiceData
              );

              subject = processed.subject;
              html = processed.html;
              text = processed.preheader || `Invoice #${invoiceNumber} - Amount: ${formattedAmount}`;
            } else {
              // Template exists but no mapping found, fall through to default
              logger.warn("Email template found but no mapping configured", {
                emailTemplateId,
                invoiceId,
                templateId: invoice.templateId,
              });
              throw new Error("Email template mapping not found");
            }
          } else {
            // Template not found, fall through to default
            logger.warn("Email template not found", { emailTemplateId });
            throw new Error("Email template not found");
          }
        } catch (error) {
          // Fall through to default template if custom template fails
          logger.warn("Failed to use custom email template, using default", {
            error: error instanceof Error ? error.message : "Unknown error",
            emailTemplateId,
          });
          // Continue to default template generation below
        }
      }

      // Use default template if custom template not provided or failed
      if (!html || html === "") {
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

