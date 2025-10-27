/**
 * Main Email Service
 * Provides a unified interface for all email operations
 */

import { EmailService, EmailSendOptions, EmailSendResult, EmailRecipient } from '@/core/ports/services/email-service';
import { EmailTemplateService } from '@/core/ports/services/email-service';
import { getEmailService, getTemplateService } from './email-service-factory';
import { COMMON_EMAIL_TEMPLATES } from '@/core/ports/services/email-service';

export class UnifiedEmailService {
  private emailService: EmailService;
  private templateService: EmailTemplateService;

  constructor() {
    this.emailService = getEmailService();
    this.templateService = getTemplateService();
  }

  /**
   * Send a simple email
   */
  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    return this.emailService.sendEmail(options);
  }

  /**
   * Send email using a template
   */
  async sendTemplateEmail(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    templateData: Record<string, unknown>,
    options: Partial<EmailSendOptions> = {}
  ): Promise<EmailSendResult> {
    return this.emailService.sendTemplateEmail(templateId, to, templateData, options);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: EmailRecipient | EmailRecipient[],
    data: {
      name: string;
      appName: string;
      dashboardUrl: string;
      supportEmail: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendTemplateEmail(COMMON_EMAIL_TEMPLATES.WELCOME, to, data);
  }

  /**
   * Send organization invite email
   */
  async sendInviteEmail(
    to: EmailRecipient | EmailRecipient[],
    data: {
      inviterName: string;
      organizationName: string;
      appName: string;
      role: string;
      inviteLink: string;
      expirationDate: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendTemplateEmail(COMMON_EMAIL_TEMPLATES.INVITE, to, data);
  }

  /**
   * Send invoice created email
   */
  async sendInvoiceCreatedEmail(
    to: EmailRecipient | EmailRecipient[],
    data: {
      invoiceNumber: string;
      companyName: string;
      customerName: string;
      amount: string;
      dueDate: string;
      description: string;
      invoiceUrl: string;
      supportEmail: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendTemplateEmail(COMMON_EMAIL_TEMPLATES.INVOICE_CREATED, to, data);
  }

  /**
   * Send workflow notification email
   */
  async sendWorkflowNotificationEmail(
    to: EmailRecipient | EmailRecipient[],
    data: {
      workflowName: string;
      status: string;
      statusColor: string;
      executedAt: string;
      duration: string;
      message?: string;
      workflowUrl: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendTemplateEmail(COMMON_EMAIL_TEMPLATES.WORKFLOW_NOTIFICATION, to, data);
  }

  /**
   * Send custom email with template
   */
  async sendCustomTemplateEmail(
    templateId: string,
    to: EmailRecipient | EmailRecipient[],
    templateData: Record<string, unknown>,
    options: Partial<EmailSendOptions> = {}
  ): Promise<EmailSendResult> {
    return this.sendTemplateEmail(templateId, to, templateData, options);
  }

  /**
   * Send batch emails
   */
  async sendBatchEmails(emails: EmailSendOptions[]): Promise<EmailSendResult[]> {
    return this.emailService.sendBatchEmails(emails);
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    return this.emailService.validateEmail(email);
  }

  /**
   * Get email service status
   */
  async getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    return this.emailService.getStatus();
  }

  /**
   * Template management methods
   */
  async getTemplates() {
    return this.templateService.getTemplates();
  }

  async getTemplate(templateId: string) {
    return this.templateService.getTemplate(templateId);
  }

  async createTemplate(template: any) {
    return this.templateService.createTemplate(template);
  }

  async updateTemplate(templateId: string, updates: any) {
    return this.templateService.updateTemplate(templateId, updates);
  }

  async deleteTemplate(templateId: string) {
    return this.templateService.deleteTemplate(templateId);
  }

  /**
   * Utility methods for common email operations
   */
  
  /**
   * Format email recipient
   */
  formatRecipient(email: string, name?: string): EmailRecipient {
    return { email, name };
  }

  /**
   * Create email options with defaults
   */
  createEmailOptions(
    to: EmailRecipient | EmailRecipient[],
    subject: string,
    content: { html?: string; text?: string },
    options: Partial<EmailSendOptions> = {}
  ): EmailSendOptions {
    return {
      to,
      subject,
      html: content.html,
      text: content.text,
      from: {
        email: 'noreply@financely.app',
        name: 'Financely',
      },
      ...options,
    };
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(
    options: EmailSendOptions,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<EmailSendResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendEmail(options);
        if (result.success) {
          return result;
        }
        lastError = new Error(result.error || 'Email sending failed');
      } catch (error) {
        lastError = error as Error;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Email sending failed after all retries',
    };
  }
}

// Export singleton instance
export const unifiedEmailService = new UnifiedEmailService();

// Export convenience functions
export const sendEmail = (options: EmailSendOptions) => unifiedEmailService.sendEmail(options);
export const sendWelcomeEmail = (to: EmailRecipient | EmailRecipient[], data: any) => 
  unifiedEmailService.sendWelcomeEmail(to, data);
export const sendInviteEmail = (to: EmailRecipient | EmailRecipient[], data: any) => 
  unifiedEmailService.sendInviteEmail(to, data);
export const sendInvoiceCreatedEmail = (to: EmailRecipient | EmailRecipient[], data: any) => 
  unifiedEmailService.sendInvoiceCreatedEmail(to, data);
export const sendWorkflowNotificationEmail = (to: EmailRecipient | EmailRecipient[], data: any) => 
  unifiedEmailService.sendWorkflowNotificationEmail(to, data);
export const validateEmail = (email: string) => unifiedEmailService.validateEmail(email);
export const getEmailServiceStatus = () => unifiedEmailService.getStatus();

