/**
 * Email Template Service
 * Manages email templates for reusable email content
 */

import {
  EmailTemplate,
  EmailTemplateService,
  EmailTemplateError,
  COMMON_EMAIL_TEMPLATES,
} from '@/core/ports/services/email-service';

export class InMemoryEmailTemplateService implements EmailTemplateService {
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
    const id = this.generateTemplateId(template.name);
    const newTemplate: EmailTemplate = {
      ...template,
      id,
    };

    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const existingTemplate = this.templates.get(templateId);
    if (!existingTemplate) {
      throw new EmailTemplateError(`Template ${templateId} not found`, templateId);
    }

    const updatedTemplate: EmailTemplate = {
      ...existingTemplate,
      ...updates,
      id: templateId, // Ensure ID doesn't change
    };

    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  async renderTemplate(templateId: string, data: Record<string, unknown>): Promise<{
    subject: string;
    html: string;
    text?: string;
  }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new EmailTemplateError(`Template ${templateId} not found`, templateId);
    }

    return {
      subject: this.renderString(template.subject, data),
      html: this.renderString(template.htmlContent, data),
      text: template.textContent ? this.renderString(template.textContent, data) : undefined,
    };
  }

  private renderString(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }

  private generateTemplateId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`;
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: EmailTemplate[] = [
      {
        id: COMMON_EMAIL_TEMPLATES.WELCOME,
        name: 'Welcome Email',
        subject: 'Welcome to {{appName}}, {{name}}!',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to {{appName}}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50;">Welcome to {{appName}}!</h1>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">Hello {{name}},</h2>
              <p>Thank you for joining {{appName}}! We're excited to have you on board.</p>
              <p>Here's what you can do next:</p>
              <ul>
                <li>Complete your profile setup</li>
                <li>Explore our features</li>
                <li>Connect with our support team if you need help</li>
              </ul>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="{{dashboardUrl}}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
            </div>
            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>If you have any questions, feel free to contact us at {{supportEmail}}</p>
            </div>
          </body>
          </html>
        `,
        textContent: `
          Welcome to {{appName}}!
          
          Hello {{name}},
          
          Thank you for joining {{appName}}! We're excited to have you on board.
          
          Here's what you can do next:
          - Complete your profile setup
          - Explore our features
          - Connect with our support team if you need help
          
          Get started: {{dashboardUrl}}
          
          If you have any questions, feel free to contact us at {{supportEmail}}
        `,
        variables: ['appName', 'name', 'dashboardUrl', 'supportEmail'],
      },
      {
        id: COMMON_EMAIL_TEMPLATES.INVITE,
        name: 'Organization Invite',
        subject: 'You\'re invited to join {{organizationName}}',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to {{organizationName}}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50;">You're Invited!</h1>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">Hello,</h2>
              <p><strong>{{inviterName}}</strong> has invited you to join <strong>{{organizationName}}</strong> on {{appName}}.</p>
              <p>As a {{role}} member, you'll have access to:</p>
              <ul>
                <li>Organization dashboard and tools</li>
                <li>Collaborative features</li>
                <li>Team communication channels</li>
              </ul>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="{{inviteLink}}" style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <p style="font-size: 12px; color: #666;">This invitation will expire on {{expirationDate}}</p>
            </div>
            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </body>
          </html>
        `,
        textContent: `
          You're Invited!
          
          Hello,
          
          {{inviterName}} has invited you to join {{organizationName}} on {{appName}}.
          
          As a {{role}} member, you'll have access to:
          - Organization dashboard and tools
          - Collaborative features
          - Team communication channels
          
          Accept invitation: {{inviteLink}}
          
          This invitation will expire on {{expirationDate}}
          
          If you didn't expect this invitation, you can safely ignore this email.
        `,
        variables: ['inviterName', 'organizationName', 'appName', 'role', 'inviteLink', 'expirationDate'],
      },
      {
        id: COMMON_EMAIL_TEMPLATES.INVOICE_CREATED,
        name: 'Invoice Created',
        subject: 'New Invoice #{{invoiceNumber}} from {{companyName}}',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice #{{invoiceNumber}}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50;">Invoice #{{invoiceNumber}}</h1>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">Hello {{customerName}},</h2>
              <p>A new invoice has been created for your account.</p>
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
                <p><strong>Amount:</strong> {{amount}}</p>
                <p><strong>Due Date:</strong> {{dueDate}}</p>
                <p><strong>Description:</strong> {{description}}</p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="{{invoiceUrl}}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a>
            </div>
            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>If you have any questions about this invoice, please contact us at {{supportEmail}}</p>
            </div>
          </body>
          </html>
        `,
        textContent: `
          Invoice #{{invoiceNumber}}
          
          Hello {{customerName}},
          
          A new invoice has been created for your account.
          
          Invoice Details:
          - Invoice Number: {{invoiceNumber}}
          - Amount: {{amount}}
          - Due Date: {{dueDate}}
          - Description: {{description}}
          
          View Invoice: {{invoiceUrl}}
          
          If you have any questions about this invoice, please contact us at {{supportEmail}}
        `,
        variables: ['invoiceNumber', 'companyName', 'customerName', 'amount', 'dueDate', 'description', 'invoiceUrl', 'supportEmail'],
      },
      {
        id: COMMON_EMAIL_TEMPLATES.WORKFLOW_NOTIFICATION,
        name: 'Workflow Notification',
        subject: 'Workflow {{workflowName}} - {{status}}',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Workflow {{workflowName}} - {{status}}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50;">Workflow Notification</h1>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">Workflow: {{workflowName}}</h2>
              <p><strong>Status:</strong> <span style="color: {{statusColor}};">{{status}}</span></p>
              <p><strong>Executed at:</strong> {{executedAt}}</p>
              <p><strong>Duration:</strong> {{duration}}</p>
              {{#if message}}
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Message:</strong> {{message}}</p>
              </div>
              {{/if}}
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="{{workflowUrl}}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Workflow</a>
            </div>
          </body>
          </html>
        `,
        textContent: `
          Workflow Notification
          
          Workflow: {{workflowName}}
          Status: {{status}}
          Executed at: {{executedAt}}
          Duration: {{duration}}
          
          {{#if message}}
          Message: {{message}}
          {{/if}}
          
          View Workflow: {{workflowUrl}}
        `,
        variables: ['workflowName', 'status', 'statusColor', 'executedAt', 'duration', 'message', 'workflowUrl'],
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
}

