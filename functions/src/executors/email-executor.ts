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

  constructor(secrets?: {
    resendApiKey?: string;
    resendFromEmail?: string;
    resendFromName?: string;
  }) {
    // Use provided secrets or fallback to environment variables
    const apiKey = secrets?.resendApiKey || process.env.RESEND_API_KEY || 're_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY';
    const fromEmail = secrets?.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@financely.app';
    const fromName = secrets?.resendFromName || process.env.RESEND_FROM_NAME || 'Financely';

    // Initialize Resend email service
    this.emailService = new ResendEmailService({
      apiKey,
      defaultFromEmail: fromEmail,
      defaultFromName: fromName,
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
        recipientCount: action.config.recipients?.length || 0 
      });

      const config = action.config as EmailExecutorConfig;
      
      // Validate required fields
      if (!config.recipients || config.recipients.length === 0) {
        throw new Error("No recipients specified");
      }
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
      const emailOptions: EmailSendOptions = {
        to: resolvedRecipients.map(email => ({ email })),
        from: {
          email: 'noreply@financely.app',
          name: 'Financely',
        },
        subject: resolvedSubject,
        html: config.isHtml ? resolvedBody : undefined,
        text: config.isHtml ? undefined : resolvedBody,
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
}
