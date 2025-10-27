/**
 * Resend Email Service Implementation for Firebase Functions
 * Simplified version without external dependencies
 */

import { logger } from "firebase-functions";
import {
  EmailService,
  EmailSendOptions,
  EmailSendResult,
  EmailServiceConfig,
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

      // For now, we'll simulate the Resend API call
      // In production, you would use the actual Resend SDK
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
    // This is a placeholder implementation
    // In production, you would use the actual Resend SDK:
    // const resend = new Resend(this.config.apiKey);
    // return await resend.emails.send(this.prepareResendData(options));

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

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock result
    return {
      id: `resend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
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
