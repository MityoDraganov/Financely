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

function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Trim whitespace and newlines
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmedEmail);
}

function validateEmailOptions(options: EmailSendOptions): void {
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
    if (!validateEmail(recipient.email)) {
        throw new EmailValidationError(`Invalid email address: ${recipient.email}`, 'to');
      }
    }

  if (!validateEmail(options.from.email)) {
      throw new EmailValidationError(`Invalid sender email: ${options.from.email}`, 'from');
    }
  }

function formatRecipient(recipient: EmailRecipient): string {
  const email = recipient.email.trim();
  const name = recipient.name?.trim();
  return name ? `${name} <${email}>` : email;
}

function prepareResendData(options: EmailSendOptions): any {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    return {
    from: formatRecipient(options.from),
    to: recipients.map(r => formatRecipient(r)),
      subject: options.subject,
      html: options.html,
      text: options.text,
    cc: options.cc ? (Array.isArray(options.cc) ? options.cc.map(r => formatRecipient(r)) : [formatRecipient(options.cc)]) : undefined,
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.map(r => formatRecipient(r)) : [formatRecipient(options.bcc)]) : undefined,
    replyTo: options.replyTo ? formatRecipient(options.replyTo) : undefined,
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

function handleError(error: unknown): EmailSendResult {
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

async function sendWithResend(
  config: EmailServiceConfig,
  options: EmailSendOptions
): Promise<{ id: string }> {
  // Use dynamic import for Resend SDK
  const { Resend } = await import('resend');
  const resend = new Resend(config.apiKey);
  
  const resendData = prepareResendData(options);
  
  logger.info("Sending email via Resend", {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'not-set',
    defaultFromEmail: config.defaultFromEmail,
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
  
  logger.info("Resend API response", { 
    hasData: !!result.data,
    hasError: !!result.error,
    dataId: result.data?.id,
    errorMessage: result.error?.message,
    errorName: result.error?.name,
    fullResult: result,
  });
  
  // CRITICAL: Check for errors in the response
  if (result.error) {
    const errorMessage = result.error.message || 'Unknown Resend API error';
    const errorName = result.error.name || 'ResendError';
    
    logger.error("Resend API returned an error", {
      error: result.error,
      message: errorMessage,
      name: errorName,
      code: result.error.message,
    });
    
    throw new EmailServiceError(
      `Resend API error: ${errorMessage}`,
      'RESEND_API_ERROR',
      result.error
    );
  }
  
  // Check if data exists
  if (!result.data || !result.data.id) {
    logger.error("Resend API returned no data or ID", { 
      result,
      hasData: !!result.data,
      dataId: result.data?.id,
    });
    throw new EmailServiceError(
      "Resend API returned no email ID",
      'RESEND_NO_DATA',
      result
    );
  }
  
  // Extract the ID from the Resend response
  return {
    id: result.data.id,
  };
}

/**
 * Create a Resend email service instance
 */
export function createResendEmailService(config: EmailServiceConfig): EmailService {
  const fullConfig: EmailServiceConfig = {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    ...config,
  };

  return {
    async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
      try {
        // Validate inputs
        validateEmailOptions(options);

        // Send email using Resend API
        const result = await sendWithResend(fullConfig, options);

        return {
          success: true,
          messageId: result.id,
          providerResponse: result,
        };
      } catch (error) {
        return handleError(error);
      }
    },

    validateEmail(email: string): boolean {
      return validateEmail(email);
    },

    async getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
      try {
        // Validate that we have a valid API key
        if (!fullConfig.apiKey || fullConfig.apiKey.length < 10) {
          return { status: 'unhealthy', details: 'Invalid API key configuration' };
        }
        
        return { status: 'healthy' };
      } catch (error) {
        return { 
          status: 'unhealthy', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    },
  };
}

// Legacy export for backward compatibility (will be removed)
export class ResendEmailService implements EmailService {
  private service: EmailService;

  constructor(config: EmailServiceConfig) {
    this.service = createResendEmailService(config);
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    return this.service.sendEmail(options);
  }

  validateEmail(email: string): boolean {
    return this.service.validateEmail(email);
  }

  async getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    return this.service.getStatus();
  }
}