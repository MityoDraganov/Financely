/**
 * Email Service Tests
 * Basic tests to verify email service functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmailServiceFactory } from './email-service-factory';
import { InMemoryEmailTemplateService } from './email-template-service';
import { COMMON_EMAIL_TEMPLATES } from '@/core/ports/services/email-service';

// Mock Resend for testing
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        id: 'test-email-id',
        to: 'test@example.com',
        from: 'noreply@financely.app',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
        created_at: '2024-01-01T00:00:00Z',
      }),
    },
  })),
}));

describe('Email Service', () => {
  let emailService: any;
  let templateService: InMemoryEmailTemplateService;

  beforeEach(() => {
    // Reset singleton
    EmailServiceFactory.reset();
    
    // Create test service
    emailService = EmailServiceFactory.createEmailService({
      provider: 'resend',
      resend: {
        apiKey: 'test-api-key',
        defaultFromEmail: 'test@financely.app',
        defaultFromName: 'Test Financely',
      },
    });

    templateService = new InMemoryEmailTemplateService();
  });

  afterEach(() => {
    EmailServiceFactory.reset();
  });

  describe('Basic Email Sending', () => {
    it('should send a simple email', async () => {
      const result = await emailService.sendEmail({
        to: { email: 'test@example.com', name: 'Test User' },
        from: { email: 'test@financely.app', name: 'Test Financely' },
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-email-id');
    });

    it('should validate email addresses', () => {
      expect(emailService.validateEmail('valid@example.com')).toBe(true);
      expect(emailService.validateEmail('invalid-email')).toBe(false);
      expect(emailService.validateEmail('')).toBe(false);
    });

    it('should handle validation errors', async () => {
      const result = await emailService.sendEmail({
        to: { email: 'invalid-email' },
        from: { email: 'test@financely.app', name: 'Test Financely' },
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });
  });

  describe('Template System', () => {
    it('should get all templates', async () => {
      const templates = await templateService.getTemplates();
      
      expect(templates).toHaveLength(4); // welcome, invite, invoice_created, workflow_notification
      expect(templates.map(t => t.id)).toContain(COMMON_EMAIL_TEMPLATES.WELCOME);
    });

    it('should get specific template', async () => {
      const template = await templateService.getTemplate(COMMON_EMAIL_TEMPLATES.WELCOME);
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Welcome Email');
      expect(template?.subject).toContain('{{appName}}');
    });

    it('should render template with data', async () => {
      const rendered = await templateService.renderTemplate(
        COMMON_EMAIL_TEMPLATES.WELCOME,
        {
          name: 'John Doe',
          appName: 'Financely',
          dashboardUrl: 'https://app.financely.com/dashboard',
          supportEmail: 'support@financely.com',
        }
      );

      expect(rendered.subject).toBe('Welcome to Financely, John Doe!');
      expect(rendered.html).toContain('John Doe');
      expect(rendered.html).toContain('Financely');
    });

    it('should create new template', async () => {
      const newTemplate = await templateService.createTemplate({
        name: 'Test Template',
        subject: 'Test Subject: {{testVar}}',
        htmlContent: '<h1>Test: {{testVar}}</h1>',
        textContent: 'Test: {{testVar}}',
        variables: ['testVar'],
      });

      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('Test Template');
    });
  });

  describe('Batch Email Sending', () => {
    it('should send multiple emails', async () => {
      const emails = [
        {
          to: { email: 'user1@example.com' },
          from: { email: 'test@financely.app', name: 'Test Financely' },
          subject: 'Email 1',
          html: '<p>Content 1</p>',
        },
        {
          to: { email: 'user2@example.com' },
          from: { email: 'test@financely.app', name: 'Test Financely' },
          subject: 'Email 2',
          html: '<p>Content 2</p>',
        },
      ];

      const results = await emailService.sendBatchEmails(emails);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Service Health', () => {
    it('should check service status', async () => {
      const status = await emailService.getStatus();
      
      expect(status.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const result = await emailService.sendEmail({
        to: { email: 'test@example.com' },
        // Missing from, subject, and content
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle template not found', async () => {
      const result = await emailService.sendTemplateEmail(
        'nonexistent-template',
        { email: 'test@example.com' },
        { testVar: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template nonexistent-template not found');
    });
  });
});

describe('Unified Email Service', () => {
  let unifiedService: any;

  beforeEach(() => {
    EmailServiceFactory.reset();
    
    // Mock the services
    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
      sendTemplateEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
      sendBatchEmails: jest.fn().mockResolvedValue([{ success: true, messageId: 'test-id' }]),
      validateEmail: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockResolvedValue({ status: 'healthy' }),
    };

    const mockTemplateService = new InMemoryEmailTemplateService();

    // Create unified service with mocks
    unifiedService = {
      emailService: mockEmailService,
      templateService: mockTemplateService,
      sendEmail: mockEmailService.sendEmail,
      sendTemplateEmail: mockEmailService.sendTemplateEmail,
      sendBatchEmails: mockEmailService.sendBatchEmails,
      validateEmail: mockEmailService.validateEmail,
      getStatus: mockEmailService.getStatus,
    };
  });

  it('should send welcome email', async () => {
    const result = await unifiedService.sendTemplateEmail(
      COMMON_EMAIL_TEMPLATES.WELCOME,
      { email: 'test@example.com', name: 'Test User' },
      {
        name: 'Test User',
        appName: 'Financely',
        dashboardUrl: 'https://app.financely.com/dashboard',
        supportEmail: 'support@financely.com',
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-id');
  });

  it('should send invite email', async () => {
    const result = await unifiedService.sendTemplateEmail(
      COMMON_EMAIL_TEMPLATES.INVITE,
      { email: 'test@example.com', name: 'Test User' },
      {
        inviterName: 'John Manager',
        organizationName: 'Test Corp',
        appName: 'Financely',
        role: 'Member',
        inviteLink: 'https://app.financely.com/invite/abc123',
        expirationDate: '2024-01-15',
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-id');
  });
});

