/**
 * Email Service Module
 * Exports all email-related services and utilities
 */

// Core interfaces and types
export * from '@/core/ports/services/email-service';

// Service implementations
export { ResendEmailService } from './resend-email-service';
export { InMemoryEmailTemplateService } from './email-template-service';
export { EmailServiceFactory, getEmailService, getTemplateService } from './email-service-factory';
export { UnifiedEmailService, unifiedEmailService } from './unified-email-service';

// Convenience exports
export {
  sendEmail,
  sendWelcomeEmail,
  sendInviteEmail,
  sendInvoiceCreatedEmail,
  sendWorkflowNotificationEmail,
  validateEmail,
  getEmailServiceStatus,
} from './unified-email-service';

// Default export
export { unifiedEmailService as default } from './unified-email-service';

