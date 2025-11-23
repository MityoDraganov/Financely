import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { ResendEmailService } from "../services/resend-email-service";
import { EmailSendOptions } from "../services/email-service-types";

export interface EmailExecutorConfig {
  recipients: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
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
      if (!config.subject) {
        throw new Error("Email subject is required");
      }
      if (!config.body) {
        throw new Error("Email body is required");
      }

      // Resolve template variables in email content
      const resolvedSubject = this.resolveTemplate(config.subject, context);
      const resolvedBody = this.resolveTemplate(config.body, context);
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
        html: config.isHtml ? resolvedBody : undefined,
        text: config.isHtml ? this.stripHtml(resolvedBody) : resolvedBody,
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

      const result: Record<string, unknown> = {
        success: emailResult.success,
        messageId: emailResult.messageId,
        recipients: resolvedRecipients,
        subject: resolvedSubject,
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
