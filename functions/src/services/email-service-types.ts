/**
 * Email Service Types and Interfaces for Functions
 * Simplified version for Firebase Functions
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  disposition?: 'attachment' | 'inline';
  cid?: string;
}

export interface EmailSendOptions {
  to: EmailRecipient | EmailRecipient[];
  from: EmailRecipient;
  subject: string;
  html?: string;
  text?: string;
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: unknown;
}

export interface EmailServiceConfig {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface EmailService {
  sendEmail(options: EmailSendOptions): Promise<EmailSendResult>;
  validateEmail(email: string): boolean;
  getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }>;
}

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

export class EmailValidationError extends EmailServiceError {
  constructor(message: string, public readonly field: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'EmailValidationError';
  }
}
