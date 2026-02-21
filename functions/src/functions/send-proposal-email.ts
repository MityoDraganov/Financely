import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { ResendEmailService } from "../services/resend-email-service";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import {
  buildRenderDataWithAliases,
  buildSourceMappingsFromPlaceholders,
  mergeMappings,
  renderTemplate,
} from "../utils/email-template-rendering";
import {
  generateBrandedEmailHTML,
  getEmailBrandingConfig,
} from "../utils/branding-email";
import { extractUserContextFromRequest } from "../utils/request-context";

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

export const sendProposalEmail = onCall<SendProposalEmailPayload, Promise<{ sent: boolean }>>(
  {
    region: "us-central1",
    cors: true,
    secrets: [resendApiKey, resendFromEmail, resendFromName],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { proposalId, toEmail, emailTemplateId } = request.data;

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
      if (!orgId) {
        throw new HttpsError("invalid-argument", "Proposal is missing organizationId");
      }

      await verifyAuthAndOrgMembership(request, orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

      const organization = await organizationRepository.get({ id: orgId });
      const brandingConfig = organization ? getEmailBrandingConfig(organization) : null;

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
      const proposalStatus = toStringValue(proposalRecord.status) || "DRAFT";
      const proposalCurrency = toStringValue(proposalRecord.currency) || "USD";
      const proposalTotal =
        typeof proposalRecord.total === "number" ? proposalRecord.total : undefined;
      const formattedTotal = formatCurrency(proposalTotal, proposalCurrency);

      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      let subject = `Proposal: ${proposalTitle}`;
      let html = "";
      let text = `${proposalTitle} (${proposalStatus}) - ${formattedTotal}`;

      if (emailTemplateId) {
        try {
          const emailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
            "emailTemplates",
            emailTemplateId,
          );

          if (!emailTemplate) {
            throw new Error("Email template not found");
          }

          if (emailTemplate.orgId && emailTemplate.orgId !== orgId) {
            throw new Error("Email template does not belong to this organization");
          }

          const sourceMappings = buildSourceMappingsFromPlaceholders(emailTemplate.placeholders);
          const mappings = mergeMappings(undefined, sourceMappings);
          const renderData = buildRenderDataWithAliases(
            {
              ...(toRecord(proposal) ?? {}),
            },
            {
              proposal: toRecord(proposal),
              lead: leadData,
              contact: customerRecord,
              customer: customerRecord,
              organization: toRecord(organization),
            },
          );

          const rendered = renderTemplate(emailTemplate, mappings, renderData, {
            escapeHtml: true,
            enableLogging: true,
          });

          subject = rendered.subject || subject;
          html = rendered.html;
          text = rendered.preheader || text;
        } catch (error) {
          logger.warn("Failed to render proposal email template, falling back to default", {
            proposalId,
            emailTemplateId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!html) {
        const content = `
          <div style="color: #111827;">
            <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">
              Proposal: ${proposalTitle}
            </h1>
            <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.5;">
              Hello ${customerName},
            </p>
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
              We prepared a proposal for you.
            </p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Status:</strong> ${proposalStatus}</p>
              <p style="margin: 0;"><strong>Total:</strong> ${formattedTotal}</p>
            </div>
          </div>
        `;

        html = brandingConfig
          ? generateBrandedEmailHTML(content, brandingConfig)
          : `
              <h1>Proposal: ${proposalTitle}</h1>
              <p>Hello ${customerName},</p>
              <p>We prepared a proposal for you.</p>
              <p><strong>Status:</strong> ${proposalStatus}</p>
              <p><strong>Total:</strong> ${formattedTotal}</p>
            `;
      }

      const result = await emailService.sendEmail({
        to: { email: toEmail, name: customerName },
        from: {
          email: resendFromEmail.value(),
          name: brandingConfig?.emailFromName || resendFromName.value(),
        },
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

      return {
        sent: result.success,
      };
    } catch (error) {
      logger.error("Error sending proposal email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send proposal email");
    }
  },
);
