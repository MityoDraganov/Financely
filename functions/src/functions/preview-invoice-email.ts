import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { handleRenderInvoicePdf } from "../app/handle-render-invoice-pdf";
import type { InvoiceDataValue } from "../core";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { evaluateTemplateCompatibility } from "../utils/email-template-compatibility";
import {
  buildRenderDataWithAliases,
  buildSourceMappingsFromPlaceholders,
  mergeMappings,
  renderTemplate,
} from "../utils/email-template-rendering";
import { getGenericRepository } from "../repositories/generic-repository";
import type { QueryConstraint } from "../core/ports/services/database-service";
import { DatabaseCollection } from "../repositories/config";
import { buildInvoiceEmailVm } from "../services/email-vm-builder";
import {
  evaluateTemplateRequirements,
  extractEmailTemplateRequirements,
} from "../utils/email-template-requirements";
import { formatInvoiceAmount } from "../utils/invoice-helpers";
import { resolveInvoicePaymentDelivery } from "../utils/invoice-payment-delivery";
import { injectSmartPaymentInstructionsBlocks } from "../utils/smart-payment-instructions";

const PREVIEW_TTL_MS = 30 * 60 * 1000;

interface PreviewInvoiceEmailPayload {
  invoiceId: string;
  emailTemplateId: string;
  toEmail?: string;
}

interface PreviewInvoiceEmailResponse {
  previewId: string;
  subject: string;
  html: string;
  text: string;
  toEmail: string;
  expiresAt: string;
  paymentDelivery: {
    status: "payable_online" | "payable_fallback" | "paid" | "cancelled";
    hasOnlineLink: boolean;
    warnings: string[];
    reference: string;
  };
}

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

interface EmailPreviewSnapshotData extends Omit<EmailPreviewSnapshot, "id"> {}

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

export const previewInvoiceEmail = onCall<
  PreviewInvoiceEmailPayload,
  Promise<PreviewInvoiceEmailResponse>
>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    const { invoiceId, emailTemplateId, toEmail } = request.data;
    const userId = request.auth?.uid;

    if (!invoiceId) {
      throw new HttpsError("invalid-argument", "invoiceId is required");
    }
    if (!emailTemplateId) {
      throw new HttpsError("invalid-argument", "emailTemplateId is required");
    }
    if (toEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      throw new HttpsError("invalid-argument", "Invalid email address format");
    }
    if (!userId) {
      throw new HttpsError("unauthenticated", "Authentication is required");
    }

    const databaseService = getDatabaseService();
    const invoiceRepository = getInvoiceRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);

    const invoice = await invoiceRepository.get({ id: invoiceId });
    if (!invoice) {
      throw new HttpsError("not-found", `Invoice not found: ${invoiceId}`);
    }
    if (!invoice.orgId) {
      throw new HttpsError("invalid-argument", "Invoice does not have an organization ID");
    }

    await verifyAuthAndOrgMembership(request, invoice.orgId, {
      requiredRole: ORGANIZATION_ROLES.MEMBER,
    });

    const organization = await organizationRepository.get({ id: invoice.orgId });
    const pdfUrl = await handleRenderInvoicePdf(invoiceId);
    const invoiceAfterPdfRender = (await invoiceRepository.get({ id: invoiceId })) ?? invoice;
    const paymentDelivery = resolveInvoicePaymentDelivery({
      invoice: invoiceAfterPdfRender as any,
      organization,
      pdfUrl,
    });
    const invoiceUrl = paymentDelivery.viewUrl || pdfUrl;

    const invoiceData = invoice.data as Record<string, InvoiceDataValue>;
    const buyer = (invoiceData.buyer || invoiceData.customer) as
      | Record<string, InvoiceDataValue>
      | undefined;
    const invoiceNumber = (invoiceData.invoiceNumber as string) || invoice.id;
    const customerName = (buyer?.name as string) || "Customer";
    const dueDate = (invoiceData.dueDate as string) || "";
    const formattedAmount = formatInvoiceAmount(invoice);
    const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : "N/A";
    const resolvedToEmail =
      toEmail ||
      ((buyer?.email as string | undefined) ?? "preview@example.com");

    const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
      "emailTemplates",
      emailTemplateId,
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
      const emailTemplateMappingRepository = getGenericRepository<
        EmailTemplateMapping,
        Omit<EmailTemplateMapping, "id">
      >(() => DatabaseCollection.EMAIL_TEMPLATE_MAPPINGS, databaseService);

      const queryConstraints = buildMappingQueryConstraints(
        invoice.orgId,
        emailTemplateId,
        invoice.templateId,
      );
      const mappings = await emailTemplateMappingRepository.getAll({ queryConstraints });
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
      const existingPaymentData = toRecord(
        (invoiceAfterPdfRender as unknown as { payment?: unknown }).payment
      );
      const invoiceLinks = {
        viewUrl: paymentDelivery.viewUrl || invoiceUrl,
        payUrl: paymentDelivery.payUrl || "",
        pdfUrl,
      };
      const invoiceEntityData: Record<string, unknown> = {
        ...(invoiceData as Record<string, unknown>),
        buyer: buyerData ?? customerData,
        customer: customerData ?? buyerData,
        invoiceUrl,
        viewUrl: invoiceLinks.viewUrl,
        payUrl: invoiceLinks.payUrl,
        pdfUrl,
        links: invoiceLinks,
        payment: {
          ...(existingPaymentData ?? {}),
          hostedInvoiceUrl:
            paymentDelivery.payUrl ||
            (typeof existingPaymentData?.hostedInvoiceUrl === "string"
              ? existingPaymentData.hostedInvoiceUrl
              : null),
        },
        paymentDelivery,
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
          email: resolvedToEmail,
          company: recipientCompanyName,
        },
        links: {
          viewUrl: invoiceLinks.viewUrl,
          payUrl: invoiceLinks.payUrl,
          pdfUrl: invoiceLinks.pdfUrl,
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
      const subject = rendered.subject || `Invoice #${invoiceNumber}`;
      const html = injectSmartPaymentInstructionsBlocks({
        html: rendered.html,
        paymentDelivery,
      });
      const text =
        rendered.preheader || `Invoice #${invoiceNumber} - Amount: ${formattedAmount}, Due: ${formattedDueDate}`;

      if (!html || !html.trim()) {
        throw new HttpsError(
          "failed-precondition",
          "Selected invoice email template rendered empty content",
        );
      }

      const mappingFingerprint = buildMappingFingerprint(mapping);
      const fingerprint = buildEmailPreviewFingerprint({
        invoiceUpdatedAt: invoiceAfterPdfRender.updatedAt ?? null,
        emailTemplateUpdatedAt: emailTemplate.updatedAt ?? null,
        mappingFingerprint,
        toEmail: resolvedToEmail,
      });
      const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();

      const previewSnapshotRepository = getGenericRepository<
        EmailPreviewSnapshot,
        EmailPreviewSnapshotData
      >(() => DatabaseCollection.EMAIL_PREVIEW_SNAPSHOTS, databaseService);

      const previewId = await previewSnapshotRepository.create({
        data: {
          orgId: invoice.orgId,
          entityType: "invoice",
          invoiceId: invoice.id,
          emailTemplateId,
          toEmail: resolvedToEmail,
          subject,
          html,
          text,
          pdfUrl,
          invoiceUpdatedAt: invoiceAfterPdfRender.updatedAt ?? null,
          emailTemplateUpdatedAt: emailTemplate.updatedAt ?? null,
          mappingId: mapping?.id ?? null,
          mappingUpdatedAt: mapping?.updatedAt ?? null,
          mappingFingerprint,
          fingerprint,
          createdByUserId: userId,
          expiresAt,
        },
      });

      return {
        previewId,
        subject,
        html,
        text,
        toEmail: resolvedToEmail,
        expiresAt,
        paymentDelivery: {
          status: paymentDelivery.status,
          hasOnlineLink: paymentDelivery.hasOnlineLink,
          warnings: paymentDelivery.warnings,
          reference: paymentDelivery.reference,
        },
      };
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

      logger.error("Failed to preview invoice email template", {
        error: error instanceof Error ? error.message : "Unknown error",
        emailTemplateId,
        invoiceId,
        details,
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "failed-precondition",
        "Selected invoice email template could not be rendered with this invoice data",
        details,
      );
    }
  },
);
