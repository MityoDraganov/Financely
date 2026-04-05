import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { ResendEmailService } from "../services/resend-email-service";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import {
  getEmailBrandingConfig,
  generateInvoiceEmailHTML,
} from "../utils/branding-email";
import { getStorage } from "firebase-admin/storage";
import { formatInvoiceAmount } from "../utils/invoice-helpers";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { getGenericRepository } from "../repositories/generic-repository";
import { DatabaseCollection } from "../repositories/config";
import {
  type InvoiceDataValue,
  type InvoiceDeliveryEvent,
  INVOICE_STATUSES,
  normalizeInvoiceStatus,
} from "../core";
import type { QueryConstraint } from "../core/ports/services/database-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import {
  buildRenderDataWithAliases,
  buildSourceMappingsFromPlaceholders,
  mergeMappings,
  renderTemplate,
} from "../utils/email-template-rendering";
import { evaluateTemplateCompatibility } from "../utils/email-template-compatibility";
import { buildInvoiceEmailVm } from "../services/email-vm-builder";
import {
  evaluateTemplateRequirements,
  extractEmailTemplateRequirements,
} from "../utils/email-template-requirements";

// Email template types (from Realtime Database)
interface EmailTemplate {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  preheader?: string;
  htmlContent: string;
  updatedAt?: string | null;
  compatMode?: "legacy_v1" | "canonical_v1";
  requirements?: {
    version: "v1";
    compatMode: "legacy_v1" | "canonical_v1";
    entityTypes: string[];
    scalarPaths: string[];
    loops: Array<{
      path: string;
      alias: string;
      rowFields: string[];
      emptyBehavior?: "hide" | "row";
    }>;
    strict: boolean;
    extractedAt?: string;
  };
  placeholders?: Array<{
    id: string;
    key: string;
    label?: string;
    description?: string;
    source?: {
      type?: string;
      entity?: string;
      path?: string;
    };
  }>;
}

// Email template mapping types (from Firestore)
interface EmailTemplateMapping {
  id: string;
  orgId: string;
  emailTemplateId: string;
  entityTemplateId?: string;
  entityType: string;
  mappings: Record<string, string>;
  updatedAt?: string | null;
}

interface EmailPreviewSnapshot {
  id: string;
  orgId: string;
  entityType: "invoice";
  invoiceId: string;
  emailTemplateId: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  pdfUrl: string;
  invoiceUpdatedAt: string | null;
  emailTemplateUpdatedAt: string | null;
  mappingId: string | null;
  mappingUpdatedAt: string | null;
  mappingFingerprint: string;
  fingerprint: string;
  createdByUserId: string;
  expiresAt: string;
}

// Define secrets using Firebase Functions Secret Manager
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendInvoiceEmailPayload {
  invoiceId: string;
  toEmail: string;
  emailTemplateId?: string;
  previewId?: string;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const buildMappingQueryConstraints = (
  orgId: string,
  emailTemplateId: string,
  invoiceTemplateId: string | undefined,
): QueryConstraint[] => {
  const queryConstraints: QueryConstraint[] = [
    { field: "orgId", operator: "==", value: orgId },
    { field: "emailTemplateId", operator: "==", value: emailTemplateId },
    { field: "entityType", operator: "==", value: "invoice" },
  ];
  if (invoiceTemplateId) {
    queryConstraints.push({
      field: "entityTemplateId",
      operator: "==",
      value: invoiceTemplateId,
    });
  }
  return queryConstraints;
};

const buildMappingFingerprint = (mapping: EmailTemplateMapping | null): string => {
  if (!mapping?.id) return "none";
  return `${mapping.id}:${mapping.updatedAt ?? ""}`;
};

const buildEmailPreviewFingerprint = ({
  invoiceUpdatedAt,
  emailTemplateUpdatedAt,
  mappingFingerprint,
  toEmail,
}: {
  invoiceUpdatedAt: string | null | undefined;
  emailTemplateUpdatedAt: string | null | undefined;
  mappingFingerprint: string;
  toEmail: string;
}): string => {
  const normalizedEmail = toEmail.trim().toLowerCase();
  return [
    invoiceUpdatedAt ?? "",
    emailTemplateUpdatedAt ?? "",
    mappingFingerprint,
    normalizedEmail,
  ].join("|");
};

const extractPdfPathFromUrl = (pdfUrl: string, bucketName: string): string => {
  if (pdfUrl.startsWith("gs://")) {
    return pdfUrl.replace(`gs://${bucketName}/`, "");
  }

  if (pdfUrl.includes("storage.googleapis.com")) {
    const urlParts = pdfUrl.split("storage.googleapis.com/");
    if (urlParts.length > 1) {
      return urlParts[1].split("?")[0].replace(`${bucketName}/`, "");
    }
    throw new Error("Could not extract PDF path from URL");
  }

  if (pdfUrl.includes("/o/")) {
    const urlParts = pdfUrl.split("/o/");
    if (urlParts.length > 1) {
      return decodeURIComponent(urlParts[1].split("?")[0]);
    }
    throw new Error("Could not extract PDF path from URL");
  }

  const urlMatch = pdfUrl.match(new RegExp(`${bucketName}/([^?]+)`));
  if (urlMatch) {
    return urlMatch[1];
  }
  const parts = pdfUrl.split(`${bucketName}/`);
  if (parts.length > 1) {
    return parts[1].split("?")[0];
  }
  throw new Error(`Could not extract PDF path from URL: ${pdfUrl}`);
};

const toInvoiceDeliveryHistory = (value: unknown): InvoiceDeliveryEvent[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is InvoiceDeliveryEvent => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.sentAt === "string";
  });
};


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
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditInvoiceId: string | undefined;
    let auditInvoiceNumber: string | undefined;
    let auditToEmail: string | undefined;
    try {
      const { invoiceId, toEmail, emailTemplateId, previewId } = request.data;
      auditInvoiceId = invoiceId;
      auditToEmail = toEmail;

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

      // Verify authentication and organization membership
      // Members can send invoice emails (owner/admin/member roles)
      if (!invoice.orgId) {
        throw new HttpsError("invalid-argument", "Invoice does not have an organization ID");
      }
      auditOrganizationId = invoice.orgId;
      await verifyAuthAndOrgMembership(request, invoice.orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

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

      const previewSnapshotRepository = getGenericRepository<
        EmailPreviewSnapshot,
        Omit<EmailPreviewSnapshot, "id">
      >(() => DatabaseCollection.EMAIL_PREVIEW_SNAPSHOTS, databaseService);
      const emailTemplateMappingRepository = getGenericRepository<
        EmailTemplateMapping,
        Omit<EmailTemplateMapping, "id">
      >(() => DatabaseCollection.EMAIL_TEMPLATE_MAPPINGS, databaseService);

      let previewSnapshot: EmailPreviewSnapshot | null = null;
      if (previewId) {
        previewSnapshot = await previewSnapshotRepository.get({ id: previewId });
        if (!previewSnapshot) {
          throw new HttpsError("failed-precondition", "Email preview session not found");
        }
        if (previewSnapshot.entityType !== "invoice") {
          throw new HttpsError("failed-precondition", "Invalid email preview session");
        }
        if (previewSnapshot.orgId !== invoice.orgId || previewSnapshot.invoiceId !== invoice.id) {
          throw new HttpsError("failed-precondition", "Email preview does not match this invoice");
        }
        if (request.auth?.uid && previewSnapshot.createdByUserId !== request.auth.uid) {
          throw new HttpsError("permission-denied", "Email preview belongs to a different user");
        }
        if (!previewSnapshot.expiresAt || Date.parse(previewSnapshot.expiresAt) <= Date.now()) {
          throw new HttpsError("failed-precondition", "Email preview has expired. Refresh preview");
        }
      }

      const resolvedEmailTemplateId = emailTemplateId ?? previewSnapshot?.emailTemplateId;
      if (
        previewSnapshot &&
        emailTemplateId &&
        emailTemplateId !== previewSnapshot.emailTemplateId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Selected template does not match generated email preview",
        );
      }

      let pdfUrl = previewSnapshot?.pdfUrl ?? "";
      if (!pdfUrl) {
        logger.info("Generating PDF for invoice", { invoiceId });
        pdfUrl = await handleRenderInvoicePdf(invoiceId);
      }

      // Download PDF from storage to attach to email
      const storage = getStorage();
      const bucket = storage.bucket();
      const pdfPath = extractPdfPathFromUrl(pdfUrl, bucket.name);
      const file = bucket.file(pdfPath);
      const [pdfBuffer] = await file.download();

      // Extract invoice data for email
      const invoiceData = invoice.data as Record<string, InvoiceDataValue>;
      const buyer = (invoiceData.buyer || invoiceData.customer) as Record<string, InvoiceDataValue> | undefined;
      
      const invoiceNumber = invoiceData.invoiceNumber as string || invoice.id;
      auditInvoiceNumber = invoiceNumber;
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

      if (previewSnapshot) {
        if (!resolvedEmailTemplateId) {
          throw new HttpsError("failed-precondition", "Email preview is missing template context");
        }
        if (previewSnapshot.toEmail.trim().toLowerCase() !== toEmail.trim().toLowerCase()) {
          throw new HttpsError(
            "failed-precondition",
            "Recipient changed after preview. Refresh preview before sending",
          );
        }

        const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
          "emailTemplates",
          resolvedEmailTemplateId,
        );
        if (!emailTemplate) {
          throw new HttpsError("failed-precondition", "Selected email template was not found");
        }
        if (emailTemplate.orgId && emailTemplate.orgId !== invoice.orgId) {
          throw new HttpsError(
            "permission-denied",
            "Selected email template does not belong to this organization",
          );
        }

        const currentMappings = await emailTemplateMappingRepository.getAll({
          queryConstraints: buildMappingQueryConstraints(
            invoice.orgId,
            resolvedEmailTemplateId,
            invoice.templateId,
          ),
        });
        const currentMapping = Array.isArray(currentMappings) ? currentMappings[0] : null;
        const currentMappingFingerprint = buildMappingFingerprint(currentMapping);
        const currentFingerprint = buildEmailPreviewFingerprint({
          invoiceUpdatedAt: invoice.updatedAt ?? null,
          emailTemplateUpdatedAt: emailTemplate.updatedAt ?? null,
          mappingFingerprint: currentMappingFingerprint,
          toEmail,
        });

        if (currentFingerprint !== previewSnapshot.fingerprint) {
          throw new HttpsError(
            "failed-precondition",
            "Invoice/template data changed after preview. Refresh preview before sending",
          );
        }

        subject = previewSnapshot.subject;
        html = previewSnapshot.html;
        text = previewSnapshot.text;
      }

      // Check if custom email template is provided (render path)
      if (!previewSnapshot && resolvedEmailTemplateId) {
        const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
          "emailTemplates",
          resolvedEmailTemplateId,
        );

        if (!emailTemplate) {
          throw new HttpsError("failed-precondition", "Selected email template was not found");
        }

        if (emailTemplate.orgId && emailTemplate.orgId !== invoice.orgId) {
          throw new HttpsError(
            "permission-denied",
            "Selected email template does not belong to this organization",
          );
        }

        const compatibility = evaluateTemplateCompatibility(emailTemplate, "invoice_send");
        if (!compatibility.compatible) {
          throw new HttpsError(
            "failed-precondition",
            "Selected email template is not compatible with invoice emails",
          );
        }

        try {
          const sourceMappings = buildSourceMappingsFromPlaceholders(emailTemplate.placeholders);
          const mappings = await emailTemplateMappingRepository.getAll({
            queryConstraints: buildMappingQueryConstraints(
              invoice.orgId,
              resolvedEmailTemplateId,
              invoice.templateId,
            ),
          });

          const mapping = Array.isArray(mappings) ? mappings[0] : null;
          const mergedMappings = mapping?.mappings
            ? mergeMappings(mapping.mappings, sourceMappings)
            : sourceMappings;

          if (
            Object.keys(mergedMappings).length === 0 &&
            (emailTemplate.placeholders?.length ?? 0) > 0
          ) {
            throw new Error("No field mappings available for this email template");
          }

          const buyerData = toRecord(invoiceData.buyer);
          const customerData = toRecord(invoiceData.customer) ?? buyerData;
          const invoiceEntityData: Record<string, unknown> = {
            ...(invoiceData as Record<string, unknown>),
            buyer: buyerData ?? customerData,
            customer: customerData ?? buyerData,
          };
          const recipientCompanyName =
            typeof customerData?.name === "string" ? customerData.name : undefined;
          const { emailVm } = buildInvoiceEmailVm({
            orgId: invoice.orgId,
            invoiceId: invoice.id,
            invoiceStatus: invoice.status,
            invoiceData: invoiceData as Record<string, unknown>,
            invoiceTemplateSnapshot: invoice.templateSnapshot,
            organization: toRecord(organization),
            recipient: {
              name: customerName,
              email: toEmail,
              company: recipientCompanyName,
            },
            links: {
              viewUrl: invoiceUrl,
              payUrl: invoiceUrl,
              pdfUrl,
            },
          });

          const renderData = buildRenderDataWithAliases(
            {
              ...invoiceEntityData,
              ...emailVm,
            },
            {
              invoice: invoiceEntityData,
              buyer: invoiceEntityData.buyer as Record<string, unknown> | undefined,
              customer: invoiceEntityData.customer as Record<string, unknown> | undefined,
              organization: toRecord(organization),
              email: emailVm.email,
            },
          );

          const compatMode = emailTemplate.compatMode === "canonical_v1" ? "canonical_v1" : "legacy_v1";
          if (compatMode === "canonical_v1") {
            const requirements =
              emailTemplate.requirements ??
              extractEmailTemplateRequirements({
                subject: emailTemplate.subject,
                preheader: emailTemplate.preheader,
                htmlContent: emailTemplate.htmlContent,
                allowedContexts: compatibility.requiredAllowedContextKeys,
                compatMode,
              });

            const diagnostics = evaluateTemplateRequirements({
              requirements,
              data: renderData,
              templateId: emailTemplate.id,
              entityType: "invoice",
              context: {
                orgId: invoice.orgId,
                invoiceId: invoice.id,
                invoiceTemplateId: invoice.templateId ?? null,
              },
            });

            if (diagnostics) {
              throw new Error(JSON.stringify(diagnostics));
            }
          }

          const rendered = renderTemplate(emailTemplate, mergedMappings, renderData, {
            escapeHtml: true,
            enableLogging: true,
          });

          subject = rendered.subject || `Invoice #${invoiceNumber}`;
          html = rendered.html;
          text = rendered.preheader || `Invoice #${invoiceNumber} - Amount: ${formattedAmount}`;
        } catch (error) {
          const details =
            error instanceof Error && error.message.startsWith("{")
              ? (() => {
                  try {
                    return JSON.parse(error.message);
                  } catch {
                    return undefined;
                  }
                })()
              : undefined;

          logger.error("Failed to render selected invoice email template", {
            error: error instanceof Error ? error.message : "Unknown error",
            emailTemplateId: resolvedEmailTemplateId,
            invoiceId,
            details,
          });
          throw new HttpsError(
            "failed-precondition",
            "Selected invoice email template could not be rendered with this invoice data",
            details,
          );
        }
      }

      // Use default template if custom template not provided or failed
      if (!html || html === "") {
        if (resolvedEmailTemplateId || previewSnapshot) {
          throw new HttpsError(
            "failed-precondition",
            "Selected invoice email template rendered empty content",
          );
        }

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

      if (result.success) {
        try {
          const sentAt = new Date().toISOString();
          const previousHistory = toInvoiceDeliveryHistory((invoice as any).deliveryHistory);
          const deliveryEvent: InvoiceDeliveryEvent = {
            method: "email",
            channel: "email",
            recipient: toEmail,
            sentAt,
            sentByUserId: request.auth?.uid,
            details: {
              emailTemplateId: resolvedEmailTemplateId ?? null,
              messageId: result.messageId ?? null,
              source: "sendInvoiceEmail",
            },
          };

          const updateData: Record<string, unknown> = {
            deliveryHistory: [...previousHistory, deliveryEvent],
          };

          const currentStatus = normalizeInvoiceStatus(invoice.status);
          if (currentStatus !== INVOICE_STATUSES.PAID && currentStatus !== INVOICE_STATUSES.CANCELLED) {
            updateData.status = INVOICE_STATUSES.SENT;
          }

          await invoiceRepository.update({
            id: invoiceId,
            data: updateData as any,
          });
        } catch (updateError) {
          logger.warn("Failed to update invoice delivery history after email send", {
            invoiceId,
            toEmail,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }
      }

      // Record usage event
      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: invoice.orgId!,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.INVOICE_SEND_EMAIL,
          metadata: {
            entityId: invoiceId,
            context: "api",
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        logger.warn("Failed to record usage event for invoice email", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      if (result.success) {
        await logAuditSuccessForRequest({
          request,
          operationName: "sendInvoiceEmail",
          organizationId: invoice.orgId,
          action: "invoice.sent",
          resource: {
            type: "invoice",
            id: invoiceId,
            name: invoiceNumber,
          },
          durationMs: Date.now() - startTime,
          metadata: {
            source: "api",
            sourceDetails: "sendInvoiceEmail",
            customFields: {
              toEmail,
              emailTemplateId: resolvedEmailTemplateId,
              previewId: previewId ?? null,
            },
          },
        });
      } else {
        await logAuditFailureForRequest({
          request,
          operationName: "sendInvoiceEmail",
          organizationId: invoice.orgId,
          action: "invoice.sent",
          error: new Error("Email service returned unsuccessful response"),
          resource: {
            type: "invoice",
            id: invoiceId,
            name: invoiceNumber,
          },
          metadata: {
            source: "api",
            sourceDetails: "sendInvoiceEmail",
            customFields: {
              toEmail,
              emailTemplateId: resolvedEmailTemplateId,
              previewId: previewId ?? null,
            },
          },
        });
      }

      return {
        sent: result.success,
      };
    } catch (error) {
      logger.error("Error sending invoice email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "sendInvoiceEmail",
        organizationId: auditOrganizationId,
        action: "invoice.sent",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditInvoiceId
          ? {
              type: "invoice",
              id: auditInvoiceId,
              name: auditInvoiceNumber || auditInvoiceId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "sendInvoiceEmail",
          customFields: {
            toEmail: auditToEmail,
            emailTemplateId: request.data?.emailTemplateId,
            previewId: request.data?.previewId,
          },
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send invoice email");
    }
  }
);
