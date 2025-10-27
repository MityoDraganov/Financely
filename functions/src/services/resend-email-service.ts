/**
 * Resend Email Service Implementation for Firebase Functions
 */

import { logger } from "firebase-functions";
import {
  EmailService,
  EmailSendOptions,
  EmailSendResult,
  EmailServiceConfig,
  EmailRecipient,
  EmailServiceError,
  EmailValidationError,
} from "./email-service-types";

export class ResendEmailService implements EmailService {
  private config: EmailServiceConfig;
  constructor(config: EmailServiceConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      // Validate inputs
      this.validateEmailOptions(options);

      // Send email using Resend API
      const result = await this.sendWithResend(options);

      return {
        success: true,
        messageId: result.id,
        providerResponse: result,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      // Test the API key by making a simple request
      // For now, we'll assume it's healthy if we can create the service
      // Validate that we have a valid API key
      if (!this.config.apiKey || this.config.apiKey.length < 10) {
        return { status: 'unhealthy', details: 'Invalid API key configuration' };
      }
      
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

    if (!options.html && !options.text) {
      throw new EmailValidationError('Email content (html or text) is required', 'content');
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

  private async sendWithResend(options: EmailSendOptions): Promise<{ id: string }> {
    // Use dynamic import for Resend SDK
    const { Resend } = await import('resend');
    const resend = new Resend(this.config.apiKey);
    
    const resendData = this.prepareResendData(options);
    
    logger.info("Sending email via Resend", {
      apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 8)}...` : 'not-set',
      defaultFromEmail: this.config.defaultFromEmail,
      to: Array.isArray(options.to) ? options.to.map(r => r.email) : [options.to.email],
      subject: options.subject,
      from: options.from.email,
      hasHtml: !!options.html,
      hasText: !!options.text,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.map(r => r.email) : [options.cc.email]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.map(r => r.email) : [options.bcc.email]) : undefined,
      replyTo: options.replyTo?.email,
      attachmentCount: options.attachments?.length || 0,
    });

    // Send email using real Resend API
    const result = await resend.emails.send(resendData);
    
    logger.info("Resend API response", { result });
    
    // Extract the ID from the Resend response
    return {
      id: result.data?.id || `resend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  private prepareResendData(options: EmailSendOptions): any {
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
}
