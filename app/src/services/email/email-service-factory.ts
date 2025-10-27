/**
 * Email Service Configuration and Factory
 * Provides centralized configuration and service instantiation
 */

import { EmailService, EmailServiceConfig, EmailTemplateService } from '@/core/ports/services/email-service';
import { ResendEmailService } from './resend-email-service';
import { InMemoryEmailTemplateService } from './email-template-service';

export interface EmailServiceFactoryConfig {
  provider: 'resend' | 'sendgrid' | 'ses' | 'mock';
  resend?: {
    apiKey: string;
    defaultFromEmail: string;
    defaultFromName?: string;
  };
  sendgrid?: {
    apiKey: string;
    defaultFromEmail: string;
    defaultFromName?: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    defaultFromEmail: string;
    defaultFromName?: string;
  };
  mock?: {
    defaultFromEmail: string;
    defaultFromName?: string;
  };
}

export class EmailServiceFactory {
  private static instance: EmailService | null = null;
  private static templateService: EmailTemplateService | null = null;

  static createEmailService(config: EmailServiceFactoryConfig): EmailService {
    switch (config.provider) {
      case 'resend':
        if (!config.resend) {
          throw new Error('Resend configuration is required when using Resend provider');
        }
        return new ResendEmailService({
          apiKey: config.resend.apiKey,
          defaultFromEmail: config.resend.defaultFromEmail,
          defaultFromName: config.resend.defaultFromName,
        });

      case 'sendgrid':
        // TODO: Implement SendGrid service
        throw new Error('SendGrid provider not implemented yet');

      case 'ses':
        // TODO: Implement AWS SES service
        throw new Error('AWS SES provider not implemented yet');

      case 'mock':
        // TODO: Implement mock service for testing
        throw new Error('Mock provider not implemented yet');

      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  }

  static getEmailService(): EmailService {
    if (!this.instance) {
      this.instance = this.createEmailService(this.getConfigFromEnvironment());
    }
    return this.instance;
  }

  static getTemplateService(): EmailTemplateService {
    if (!this.templateService) {
      this.templateService = new InMemoryEmailTemplateService();
    }
    return this.templateService;
  }

  static reset(): void {
    this.instance = null;
    this.templateService = null;
  }

  private static getConfigFromEnvironment(): EmailServiceFactoryConfig {
    const provider = (process.env.EMAIL_PROVIDER || 'resend') as EmailServiceFactoryConfig['provider'];
    
    switch (provider) {
      case 'resend':
        const resendApiKey = process.env.RESEND_API_KEY;
        const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@financely.app';
        const resendFromName = process.env.RESEND_FROM_NAME || 'Financely';

        if (!resendApiKey) {
          throw new Error('RESEND_API_KEY environment variable is required');
        }

        return {
          provider: 'resend',
          resend: {
            apiKey: resendApiKey,
            defaultFromEmail: resendFromEmail,
            defaultFromName: resendFromName,
          },
        };

      case 'sendgrid':
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@financely.app';
        const sendgridFromName = process.env.SENDGRID_FROM_NAME || 'Financely';

        if (!sendgridApiKey) {
          throw new Error('SENDGRID_API_KEY environment variable is required');
        }

        return {
          provider: 'sendgrid',
          sendgrid: {
            apiKey: sendgridApiKey,
            defaultFromEmail: sendgridFromEmail,
            defaultFromName: sendgridFromName,
          },
        };

      case 'ses':
        const sesRegion = process.env.AWS_SES_REGION || 'us-east-1';
        const sesAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const sesSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const sesFromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@financely.app';
        const sesFromName = process.env.AWS_SES_FROM_NAME || 'Financely';

        if (!sesAccessKeyId || !sesSecretAccessKey) {
          throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for SES');
        }

        return {
          provider: 'ses',
          ses: {
            region: sesRegion,
            accessKeyId: sesAccessKeyId,
            secretAccessKey: sesSecretAccessKey,
            defaultFromEmail: sesFromEmail,
            defaultFromName: sesFromName,
          },
        };

      case 'mock':
        return {
          provider: 'mock',
          mock: {
            defaultFromEmail: 'test@financely.app',
            defaultFromName: 'Financely Test',
          },
        };

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }
}

// Convenience functions for easy access
export const getEmailService = (): EmailService => EmailServiceFactory.getEmailService();
export const getTemplateService = (): EmailTemplateService => EmailServiceFactory.getTemplateService();

// Pre-configured service instances
export const emailService = getEmailService();
export const templateService = getTemplateService();

