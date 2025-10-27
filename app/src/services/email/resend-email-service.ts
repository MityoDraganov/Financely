/**
 * Resend Email Service Implementation
 * Provides email functionality using Resend API
 */

import { Resend } from 'resend';
import {
  EmailService,
  EmailSendOptions,
  EmailSendResult,
  EmailServiceConfig,
  EmailRecipient,
  EmailAttachment,
  EmailServiceError,
  EmailValidationError,
} from '@/core/ports/services/email-service';

export class ResendEmailService implements EmailService {
  private resend: Resend;
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    
    this.resend = new Resend(this.config.apiKey);
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      // Validate inputs
      this.validateEmailOptions(options);

      // Prepare Resend email data
      const emailData = this.prepareEmailData(options);

      // Send email with retry logic
      const result = await this.sendWithRetry(emailData);

      return {
        success: true,
        messageId: result.id,
        providerResponse: result,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async sendBatchEmails(emails: EmailSendOptions[]): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    
    // Process emails in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(email => this.sendEmail(email))
      );
      
      results.push(
        ...batchResults.map(result => 
          result.status === 'fulfilled' 
            ? result.value 
            : { success: false, error: result.reason?.message || 'Unknown error' }
        )
      );
    }

    return results;
  }

  async sendTemplateEmail(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    templateData: Record<string, unknown>,
    options: Partial<EmailSendOptions> = {}
  ): Promise<EmailSendResult> {
    // For now, we'll implement basic template rendering
    // In a full implementation, you'd integrate with a template service
    const template = await this.getTemplate(templateId);
    
    if (!template) {
      throw new EmailServiceError(`Template ${templateId} not found`, 'TEMPLATE_NOT_FOUND');
    }

    const renderedSubject = this.renderTemplate(template.subject, templateData);
    const renderedHtml = this.renderTemplate(template.htmlContent, templateData);
    const renderedText = template.textContent ? this.renderTemplate(template.textContent, templateData) : undefined;

    return this.sendEmail({
      ...options,
      to,
      subject: renderedSubject,
      html: renderedHtml,
      text: renderedText,
    });
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      // Test the API key by making a simple request
      // Resend doesn't have a dedicated health check endpoint, so we'll use a minimal request
      await this.resend.emails.send({
        from: this.config.defaultFromEmail,
        to: 'test@example.com',
        subject: 'Health Check',
        html: '<p>Health check</p>',
      });
      
      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private validateEmailOptions(options: EmailSendOptions): void {
    if (!options.to) {
      throw new EmailValidationError('Recipient is required', 'to');
    }

    if (!options.from) {
      throw new EmailValidationError('Sender is required', 'from');
    }

    if (!options.subject) {
      throw new EmailValidationError('Subject is required', 'subject');
    }

    if (!options.html && !options.text && !options.templateId) {
      throw new EmailValidationError('Email content (html, text, or templateId) is required', 'content');
    }

    // Validate email addresses
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    for (const recipient of recipients) {
      if (!this.validateEmail(recipient.email)) {
        throw new EmailValidationError(`Invalid email address: ${recipient.email}`, 'to');
      }
    }

    if (!this.validateEmail(options.from.email)) {
      throw new EmailValidationError(`Invalid sender email: ${options.from.email}`, 'from');
    }
  }

  private prepareEmailData(options: EmailSendOptions) {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    return {
      from: this.formatRecipient(options.from),
      to: recipients.map(r => this.formatRecipient(r)),
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.map(r => this.formatRecipient(r)) : [this.formatRecipient(options.cc)]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.map(r => this.formatRecipient(r)) : [this.formatRecipient(options.bcc)]) : undefined,
      reply_to: options.replyTo ? this.formatRecipient(options.replyTo) : undefined,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        content_type: att.contentType,
        disposition: att.disposition || 'attachment',
        cid: att.cid,
      })),
      tags: options.tags ? Object.entries(options.tags).map(([key, value]) => ({ name: key, value })) : undefined,
      headers: options.headers,
    };
  }

  private formatRecipient(recipient: EmailRecipient): string {
    return recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;
  }

  private async sendWithRetry(emailData: any): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        return await this.resend.emails.send(emailData);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts!) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to send email after all retry attempts');
  }

  private handleError(error: unknown): EmailSendResult {
    if (error instanceof EmailValidationError) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (error instanceof EmailServiceError) {
      return {
        success: false,
        error: error.message,
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }

  private async getTemplate(templateId: string): Promise<{ subject: string; htmlContent: string; textContent?: string } | null> {
    // This is a placeholder implementation
    // In a real application, you'd fetch templates from a database or template service
    const templates: Record<string, { subject: string; htmlContent: string; textContent?: string }> = {
      'welcome': {
        subject: 'Welcome to {{appName}}!',
        htmlContent: '<h1>Welcome {{name}}!</h1><p>Thank you for joining {{appName}}.</p>',
        textContent: 'Welcome {{name}}! Thank you for joining {{appName}}.',
      },
      'invite': {
        subject: 'You\'re invited to join {{organizationName}}',
        htmlContent: '<h1>You\'re invited!</h1><p>{{inviterName}} has invited you to join {{organizationName}}.</p><p><a href="{{inviteLink}}">Accept Invitation</a></p>',
        textContent: 'You\'re invited! {{inviterName}} has invited you to join {{organizationName}}. Accept invitation: {{inviteLink}}',
      },
    };

    return templates[templateId] || null;
  }
}

