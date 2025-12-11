/**
 * Core email service types and interfaces
 * Provides a unified interface for email operations across the application
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer; // Base64 encoded string or Buffer
  contentType: string;
  disposition?: 'attachment' | 'inline';
  cid?: string; // Content-ID for inline attachments
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: string[]; // List of available template variables
}

export interface EmailSendOptions {
  to: EmailRecipient | EmailRecipient[];
  from: EmailRecipient;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>; // For email tracking and categorization
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
  /**
   * Send a single email
   */
  sendEmail(options: EmailSendOptions): Promise<EmailSendResult>;

  /**
   * Send multiple emails in batch
   */
  sendBatchEmails(emails: EmailSendOptions[]): Promise<EmailSendResult[]>;

  /**
   * Send email using a template
   */
  sendTemplateEmail(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    templateData: Record<string, unknown>,
    options?: Partial<EmailSendOptions>
  ): Promise<EmailSendResult>;

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean;

  /**
   * Get email service status/health
   */
  getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }>;
}

export interface EmailTemplateService {
  /**
   * Get all available templates
   */
  getTemplates(): Promise<EmailTemplate[]>;

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): Promise<EmailTemplate | null>;

  /**
   * Create a new template
   */
  createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate>;

  /**
   * Update an existing template
   */
  updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): Promise<boolean>;

  /**
   * Render template with data
   */
  renderTemplate(templateId: string, data: Record<string, unknown>): Promise<{
    subject: string;
    html: string;
    text?: string;
  }>;
}

// Common email templates
export const COMMON_EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  INVITE: 'invite',
  INVOICE_CREATED: 'invoice_created',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_OVERDUE: 'invoice_overdue',
  PASSWORD_RESET: 'password_reset',
  WORKFLOW_NOTIFICATION: 'workflow_notification',
} as const;

export type CommonEmailTemplate = typeof COMMON_EMAIL_TEMPLATES[keyof typeof COMMON_EMAIL_TEMPLATES];

// Email service error types
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

export class EmailTemplateError extends EmailServiceError {
  constructor(message: string, public readonly templateId?: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'EmailTemplateError';
  }
}

