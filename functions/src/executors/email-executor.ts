import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { ResendEmailService } from "../services/resend-email-service";
import { EmailSendOptions } from "../services/email-service-types";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import {
  buildRenderDataWithAliases,
  buildSourceMappingsFromPlaceholders,
  mergeMappings,
  renderTemplate,
} from "../utils/email-template-rendering";

export interface EmailExecutorConfig {
  mode?: "manual" | "template";
  recipients: string[];
  subject?: string;
  body?: string;
  isHtml?: boolean;
  emailTemplateId?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded content
    contentType: string;
  }>;
}

export class EmailExecutor implements ActionExecutor {
  type = "send_email";
  private emailService: ResendEmailService;
  private fromEmail: string;
  private fromName: string;

  constructor(secrets?: {
    resendApiKey?: string;
    resendFromEmail?: string;
    resendFromName?: string;
  }) {
    // Secrets are required - no fallback to process.env in Firebase Functions
    if (!secrets?.resendApiKey) {
      throw new Error("RESEND_API_KEY secret is required for EmailExecutor");
    }
    if (!secrets?.resendFromEmail) {
      throw new Error("RESEND_FROM_EMAIL secret is required for EmailExecutor");
    }
    if (!secrets?.resendFromName) {
      throw new Error("RESEND_FROM_NAME secret is required for EmailExecutor");
    }

    // Store from email/name for use in execute method
    this.fromEmail = secrets.resendFromEmail;
    this.fromName = secrets.resendFromName;

    // Initialize Resend email service
    this.emailService = new ResendEmailService({
      apiKey: secrets.resendApiKey,
      defaultFromEmail: secrets.resendFromEmail,
      defaultFromName: secrets.resendFromName,
    });
  }

  /**
   * Execute an email action
   */
  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing email action", { 
        runId, 
        actionId: action.id,
        actionType: action.type,
        recipientCount: action.config?.recipients?.length || 0,
        hasConfig: !!action.config,
        configKeys: action.config ? Object.keys(action.config) : [],
        fullAction: JSON.stringify(action, null, 2)
      });

      const config = action.config as EmailExecutorConfig;
      
      // Validate required fields
      if (!config || !config.recipients || config.recipients.length === 0) {
        logger.error("Email action validation failed", {
          runId,
          actionId: action.id,
          hasConfig: !!config,
          recipients: config?.recipients,
          recipientCount: config?.recipients?.length || 0,
          configStructure: config ? Object.keys(config) : [],
          fullAction: JSON.stringify(action, null, 2),
          contextKeys: Object.keys(context)
        });
        throw new Error(`Email action "${action.name || action.id}" has no recipients specified. Please add at least one recipient email address in the workflow configuration.`);
      }
      
      // Filter out empty recipient strings
      const validRecipients = config.recipients.filter((email: string) => email && email.trim().length > 0);
      if (validRecipients.length === 0) {
        logger.error("Email action has no valid recipients after filtering", {
          runId,
          actionId: action.id,
          originalRecipients: config.recipients
        });
        throw new Error(`Email action "${action.name || action.id}" has no valid recipients. All recipient email addresses are empty.`);
      }
      
      // Use filtered recipients
      config.recipients = validRecipients;

      const mode = config.mode ?? "manual";
      let resolvedSubject = "";
      let resolvedBody = "";

      if (mode === "template") {
        if (!config.emailTemplateId || config.emailTemplateId.trim().length === 0) {
          throw new Error("Email template is required in template mode");
        }

        const emailTemplate = await realtimeDatabaseService.get<{
          id: string;
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
        }>("emailTemplates", config.emailTemplateId);

        if (!emailTemplate) {
          throw new Error(`Email template not found: ${config.emailTemplateId}`);
        }

        const sourceMappings = buildSourceMappingsFromPlaceholders(emailTemplate.placeholders);
        const mappings = mergeMappings(undefined, sourceMappings);
        const renderData = this.buildTemplateRenderData(context);
        const rendered = renderTemplate(emailTemplate, mappings, renderData, {
          escapeHtml: true,
          enableLogging: true,
        });

        resolvedSubject = rendered.subject;
        resolvedBody = rendered.html;
      } else {
        if (!config.subject || config.subject.trim().length === 0) {
          throw new Error("Email subject is required");
        }
        if (!config.body || config.body.trim().length === 0) {
          throw new Error("Email body is required");
        }

        // Resolve template variables in manual content mode
        resolvedSubject = this.resolveTemplate(config.subject, context);
        resolvedBody = this.resolveTemplate(config.body, context);
      }

      const resolvedRecipients = config.recipients.map(email => this.resolveTemplate(email, context));
      const resolvedCc = config.cc?.map(email => this.resolveTemplate(email, context)) || [];
      const resolvedBcc = config.bcc?.map(email => this.resolveTemplate(email, context)) || [];
      const resolvedReplyTo = config.replyTo ? this.resolveTemplate(config.replyTo, context) : undefined;

      // Prepare email options for the new service
      // Following the same pattern as invoice emails (send-invoice-email.ts)
      const emailOptions: EmailSendOptions = {
        to: resolvedRecipients.map(email => ({ email })),
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: resolvedSubject,
        // Always provide both html and text for better email client compatibility
        html: mode === "template" || config.isHtml ? resolvedBody : undefined,
        text: mode === "template" || config.isHtml ? this.stripHtml(resolvedBody) : resolvedBody,
        cc: resolvedCc.length > 0 ? resolvedCc.map(email => ({ email })) : undefined,
        bcc: resolvedBcc.length > 0 ? resolvedBcc.map(email => ({ email })) : undefined,
        replyTo: resolvedReplyTo ? { email: resolvedReplyTo } : undefined,
        attachments: config.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      // Send email using the new service
      const emailResult = await this.emailService.sendEmail(emailOptions);

      logger.info("Email sent successfully", { 
        runId, 
        actionId: action.id,
        recipientCount: resolvedRecipients.length,
        messageId: emailResult.messageId 
      });

      // Record usage event
      try {
        const orgId = context.orgId as string || context.tenantId as string;
        if (orgId) {
          const { recordUsageEvent } = await import("../usage");
          const { USAGE_FEATURES } = await import("../usage/usage-features");
          
          await recordUsageEvent({
            orgId,
            userId: null, // Workflow actions are system-triggered
            featureId: USAGE_FEATURES.WORKFLOW_ACTION_EMAIL,
            metadata: {
              context: "automation",
            },
          });
        }
      } catch (usageError) {
        logger.warn("Failed to record usage event for email action", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      const result: Record<string, unknown> = {
        success: emailResult.success,
        messageId: emailResult.messageId,
        recipients: resolvedRecipients,
        subject: resolvedSubject,
        mode,
        emailTemplateId: config.emailTemplateId,
        sentAt: new Date().toISOString(),
      };

      // Only include error if it exists (not undefined)
      if (emailResult.error) {
        result.error = emailResult.error;
      }

      return result;

    } catch (error) {
      logger.error("Error executing email action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      
      throw error;
    }
  }

  /**
   * Resolve template variables in text
   * Supports {variable} and {object.property} syntax
   */
  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }

  private buildTemplateRenderData(context: Record<string, unknown>): Record<string, unknown> {
    const dataContext = this.toRecord(context._dataContext);
    const invoiceFromDataContext = this.toRecord(this.toRecord(dataContext?.invoice)?.data);
    const customerFromDataContext = this.toRecord(dataContext?.customer);
    const organizationFromDataContext = this.toRecord(dataContext?.organization);

    const invoiceAlias =
      invoiceFromDataContext ||
      this.toRecord(context.invoice) ||
      this.toRecord(context.data);
    const contactAlias =
      customerFromDataContext ||
      this.toRecord(context.contact) ||
      this.toRecord(context.customer) ||
      this.toRecord(context.data);
    const proposalAlias = this.toRecord(context.proposal);
    const productAlias = this.toRecord(context.product);

    return buildRenderDataWithAliases(
      {
        ...context,
        ...(invoiceAlias ?? {}),
      },
      {
        invoice: invoiceAlias,
        contact: contactAlias,
        customer: contactAlias,
        proposal: proposalAlias,
        product: productAlias,
        organization: organizationFromDataContext,
      },
    );
  }

  /**
   * Strip HTML tags from text for plain text fallback
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .trim();
  }
}
