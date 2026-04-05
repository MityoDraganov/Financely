import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { ResendEmailService } from "../services/resend-email-service";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import {
  PROPOSAL_STATUSES,
  normalizeProposalStatus,
  type ProposalDeliveryEvent,
} from "../core/entities/proposal";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import {
  buildRenderDataWithAliases,
  buildSourceMappingsFromPlaceholders,
  mergeMappings,
  renderTemplate,
} from "../utils/email-template-rendering";
import { evaluateTemplateCompatibility } from "../utils/email-template-compatibility";
import { buildProposalEmailVm } from "../services/email-vm-builder";
import {
  evaluateTemplateRequirements,
  extractEmailTemplateRequirements,
} from "../utils/email-template-requirements";
import {
  generateProposalEmailHTML,
  getEmailBrandingConfig,
} from "../utils/branding-email";
import { extractUserContextFromRequest } from "../utils/request-context";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendProposalEmailPayload {
  proposalId: string;
  toEmail: string;
  emailTemplateId?: string;
}

interface EmailTemplate {
  id: string;
  orgId: string;
  subject?: string;
  preheader?: string;
  htmlContent?: string;
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
    key?: string;
    source?: {
      type?: string;
      entity?: string;
      path?: string;
    };
  }>;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const toStringValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const formatCurrency = (value: number | undefined, currency: string | undefined): string => {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const normalizedCurrency = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${normalizedCurrency}`;
  }
};

const toProposalDeliveryHistory = (value: unknown): ProposalDeliveryEvent[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is ProposalDeliveryEvent => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.sentAt === "string";
  });
};

export const sendProposalEmail = onCall<SendProposalEmailPayload, Promise<{ sent: boolean }>>(
  {
    region: "us-central1",
    cors: true,
    secrets: [resendApiKey, resendFromEmail, resendFromName],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditProposalId: string | undefined;
    let auditProposalTitle: string | undefined;
    let auditToEmail: string | undefined;
    try {
      const { proposalId, toEmail, emailTemplateId } = request.data;
      auditProposalId = proposalId;
      auditToEmail = toEmail;

      if (!proposalId) {
        throw new HttpsError("invalid-argument", "proposalId is required");
      }
      if (!toEmail) {
        throw new HttpsError("invalid-argument", "toEmail is required");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(toEmail)) {
        throw new HttpsError("invalid-argument", "Invalid email address format");
      }

      const databaseService = getDatabaseService();
      const proposalRepository = getProposalRepository(databaseService);
      const leadRepository = getLeadRepository(databaseService);
      const contactRepository = getContactRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);

      const proposal = await proposalRepository.get({ id: proposalId });
      if (!proposal) {
        throw new HttpsError("not-found", `Proposal not found: ${proposalId}`);
      }

      const proposalRecord = proposal as unknown as Record<string, unknown>;
      const orgId = toStringValue(proposalRecord.organizationId) || toStringValue(proposalRecord.orgId);
      auditOrganizationId = orgId;
      if (!orgId) {
        throw new HttpsError("invalid-argument", "Proposal is missing organizationId");
      }

      await verifyAuthAndOrgMembership(request, orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

      const organization = await organizationRepository.get({ id: orgId });
      const brandingConfig = organization ? getEmailBrandingConfig(organization) : null;
      const orgRecord = organization ? (organization as unknown as Record<string, unknown>) : null;
      const orgSettings =
        orgRecord?.settings && typeof orgRecord.settings === "object"
          ? (orgRecord.settings as Record<string, unknown>)
          : null;
      const orgContactEmail = toStringValue(orgSettings?.email) || null;
      const replyToEmail =
        orgContactEmail ||
        (brandingConfig?.emailFromAddress && !brandingConfig.emailFromAddress.includes("noreply")
          ? brandingConfig.emailFromAddress
          : null);

      let leadRecord: Record<string, unknown> | undefined;
      const leadId = toStringValue(proposalRecord.leadId);
      if (leadId) {
        try {
          const lead = await leadRepository.get({ id: leadId });
          leadRecord = lead ? (lead as unknown as Record<string, unknown>) : undefined;
        } catch (error) {
          logger.warn("Failed to fetch lead for proposal email", {
            proposalId,
            leadId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const leadData = toRecord(leadRecord?.data);
      const contactId = toStringValue(leadData?.contactId);

      let contactRecord: Record<string, unknown> | undefined;
      if (contactId) {
        try {
          const contact = await contactRepository.get({ id: contactId });
          contactRecord = contact ? (contact as unknown as Record<string, unknown>) : undefined;
        } catch (error) {
          logger.warn("Failed to fetch contact for proposal email", {
            proposalId,
            contactId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const contactData = toRecord(contactRecord?.data);
      const customerRecord = contactData ?? leadData;

      const customerName =
        `${toStringValue(customerRecord?.firstName)} ${toStringValue(customerRecord?.lastName)}`.trim() ||
        toStringValue(customerRecord?.name) ||
        "Customer";

      const proposalTitle = toStringValue(proposalRecord.title) || proposalId;
      auditProposalTitle = proposalTitle;
      const proposalStatus = normalizeProposalStatus(toStringValue(proposalRecord.status));
      const proposalCurrency = toStringValue(proposalRecord.currency) || "USD";
      const proposalTotal =
        typeof proposalRecord.total === "number" ? proposalRecord.total : undefined;
      const formattedTotal = formatCurrency(proposalTotal, proposalCurrency);

      const proposalNumber = toStringValue(proposalRecord.number ?? proposalRecord.proposalNumber);
      const proposalDescription = toStringValue(proposalRecord.description);
      const proposalNotes = toStringValue(proposalRecord.notes);
      const proposalTerms = toStringValue(proposalRecord.terms);
      const proposalValidUntil = toStringValue(proposalRecord.validUntil ?? proposalRecord.expiresAt);
      const proposalViewUrl = toStringValue(proposalRecord.publicUrl ?? proposalRecord.viewUrl);
      const proposalApproveUrl = toStringValue(
        (toRecord(proposalRecord.approval) ?? {}).url ?? proposalRecord.approveUrl
      );
      const proposalPdfUrl = toStringValue(proposalRecord.pdfUrl);
      const customerCompany = toStringValue(
        customerRecord?.company ?? customerRecord?.organizationName
      );
      const proposalItems = Array.isArray(proposalRecord.items)
        ? (proposalRecord.items as Array<Record<string, unknown>>).map((item) => ({
            description: toStringValue(item.description),
            qty: typeof item.qty === "number" ? item.qty : Number(item.qty) || 1,
            unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice) || 0,
            taxPct: typeof item.taxPct === "number" ? item.taxPct : undefined,
          }))
        : undefined;

      const orgName = brandingConfig?.companyName || "Us";
      const titleHasProposal = /proposal/i.test(proposalTitle);

      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      let subject = titleHasProposal
        ? `${orgName}: ${proposalTitle}`
        : `${orgName}: Proposal – ${proposalTitle}`;
      let html = "";
      let text = `${proposalTitle} – ${formattedTotal}${proposalValidUntil ? ` (valid until ${proposalValidUntil})` : ""}`;

      if (emailTemplateId) {
        const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
          "emailTemplates",
          emailTemplateId,
        );

        if (!emailTemplate) {
          throw new HttpsError("failed-precondition", "Selected email template was not found");
        }

        if (emailTemplate.orgId && emailTemplate.orgId !== orgId) {
          throw new HttpsError(
            "permission-denied",
            "Selected email template does not belong to this organization",
          );
        }

        const compatibility = evaluateTemplateCompatibility(emailTemplate, "proposal_send");
        if (!compatibility.compatible) {
          throw new HttpsError(
            "failed-precondition",
            "Selected email template is not compatible with proposal emails",
          );
        }

        try {
          const sourceMappings = buildSourceMappingsFromPlaceholders(emailTemplate.placeholders);
          const mappings = mergeMappings(undefined, sourceMappings);
          const { emailVm } = buildProposalEmailVm({
            orgId,
            proposalId: proposalId,
            proposal: toRecord(proposal) ?? {},
            organization: toRecord(organization),
            recipient: {
              name: customerName,
              email: toEmail,
              company: toStringValue(customerRecord?.company ?? customerRecord?.name) || undefined,
            },
          });
          const renderData = buildRenderDataWithAliases(
            {
              ...(toRecord(proposal) ?? {}),
              ...emailVm,
            },
            {
              proposal: toRecord(proposal),
              lead: leadData,
              contact: customerRecord,
              customer: customerRecord,
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
              entityType: "proposal",
              context: {
                orgId,
                proposalId,
              },
            });

            if (diagnostics) {
              throw new Error(JSON.stringify(diagnostics));
            }
          }

          const rendered = renderTemplate(emailTemplate, mappings, renderData, {
            escapeHtml: true,
            enableLogging: true,
          });

          subject = rendered.subject || subject;
          html = rendered.html;
          text = rendered.preheader || text;
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

          logger.error("Failed to render selected proposal email template", {
            proposalId,
            emailTemplateId,
            error: error instanceof Error ? error.message : String(error),
            details,
          });
          throw new HttpsError(
            "failed-precondition",
            "Selected proposal email template could not be rendered with this proposal data",
            details,
          );
        }
      }

      if (!html) {
        if (emailTemplateId) {
          throw new HttpsError(
            "failed-precondition",
            "Selected proposal email template rendered empty content",
          );
        }

        if (brandingConfig) {
          html = generateProposalEmailHTML(
            {
              proposalTitle,
              customerName,
              customerCompany: customerCompany || undefined,
              formattedTotal,
              proposalNumber: proposalNumber || undefined,
              validUntil: proposalValidUntil || undefined,
              description: proposalDescription || undefined,
              notes: proposalNotes || undefined,
              terms: proposalTerms || undefined,
              items: proposalItems,
              viewUrl: proposalViewUrl || undefined,
              approveUrl: proposalApproveUrl || undefined,
              pdfUrl: proposalPdfUrl || undefined,
              replyToEmail: replyToEmail || undefined,
            },
            brandingConfig,
          );
        } else {
          html = `
            <h1>${proposalTitle}</h1>
            <p>Hello ${customerName},</p>
            <p>${orgName} has prepared a proposal for you.</p>
            ${proposalNumber ? `<p><strong>Reference:</strong> #${proposalNumber}</p>` : ""}
            ${proposalValidUntil ? `<p><strong>Valid Until:</strong> ${proposalValidUntil}</p>` : ""}
            <p><strong>Total:</strong> ${formattedTotal}</p>
            ${proposalViewUrl ? `<p><a href="${proposalViewUrl}">Review Proposal</a></p>` : ""}
          `;
        }
      }

      const result = await emailService.sendEmail({
        to: { email: toEmail, name: customerName },
        from: {
          email: resendFromEmail.value(),
          name: brandingConfig?.emailFromName || resendFromName.value(),
        },
        ...(replyToEmail ? { replyTo: { email: replyToEmail, name: orgName } } : {}),
        subject,
        html,
        text,
      });

      logger.info("Proposal email sent successfully", {
        proposalId,
        toEmail,
        emailTemplateId,
        success: result.success,
        messageId: result.messageId,
      });

      if (result.success) {
        try {
          const sentAt = new Date().toISOString();
          const previousHistory = toProposalDeliveryHistory(proposalRecord.deliveryHistory);
          const deliveryEvent: ProposalDeliveryEvent = {
            method: "email",
            channel: "email",
            recipient: toEmail,
            sentAt,
            sentByUserId: request.auth?.uid,
            details: {
              emailTemplateId: emailTemplateId ?? null,
              messageId: result.messageId ?? null,
              source: "sendProposalEmail",
            },
          };

          const updateData: Record<string, unknown> = {
            deliveryHistory: [...previousHistory, deliveryEvent],
          };

          if (proposalStatus !== PROPOSAL_STATUSES.ACCEPTED && proposalStatus !== PROPOSAL_STATUSES.INVOICED) {
            updateData.status = PROPOSAL_STATUSES.SENT;
          }

          await proposalRepository.update({
            id: proposalId,
            data: updateData as any,
          });
        } catch (updateError) {
          logger.warn("Failed to update proposal delivery history after email send", {
            proposalId,
            toEmail,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }
      }

      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");

        await recordUsageEvent({
          orgId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.PROPOSAL_SEND,
          metadata: {
            entityId: proposalId,
            context: "api",
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage event for proposal email", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      if (result.success) {
        await logAuditSuccessForRequest({
          request,
          operationName: "sendProposalEmail",
          organizationId: orgId,
          action: "proposal.sent",
          resource: {
            type: "proposal",
            id: proposalId,
            name: proposalTitle,
          },
          durationMs: Date.now() - startTime,
          metadata: {
            source: "api",
            sourceDetails: "sendProposalEmail",
            customFields: {
              toEmail,
              emailTemplateId,
            },
          },
        });
      } else {
        await logAuditFailureForRequest({
          request,
          operationName: "sendProposalEmail",
          organizationId: orgId,
          action: "proposal.sent",
          error: new Error("Email service returned unsuccessful response"),
          resource: {
            type: "proposal",
            id: proposalId,
            name: proposalTitle,
          },
          metadata: {
            source: "api",
            sourceDetails: "sendProposalEmail",
            customFields: {
              toEmail,
              emailTemplateId,
            },
          },
        });
      }

      return {
        sent: result.success,
      };
    } catch (error) {
      logger.error("Error sending proposal email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "sendProposalEmail",
        organizationId: auditOrganizationId,
        action: "proposal.sent",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditProposalId
          ? {
              type: "proposal",
              id: auditProposalId,
              name: auditProposalTitle || auditProposalId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "sendProposalEmail",
          customFields: {
            toEmail: auditToEmail,
            emailTemplateId: request.data?.emailTemplateId,
          },
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send proposal email");
    }
  },
);
