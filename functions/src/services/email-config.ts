/**
 * Email Service Configuration for Firebase Functions
 * Uses Google Cloud Secret Manager for secure environment variable management
 */

import { defineSecret } from "firebase-functions/params";

// Define secrets for Resend configuration
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

export interface EmailConfig {
  provider: 'resend' | 'mock';
  resend?: {
    apiKey: string;
    defaultFromEmail: string;
    defaultFromName?: string;
  };
  mock?: {
    defaultFromEmail: string;
    defaultFromName?: string;
  };
}

export function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || 'resend') as EmailConfig['provider'];
  
  switch (provider) {
    case 'resend':
      return {
        provider: 'resend',
        resend: {
          apiKey: resendApiKey.value(),
          defaultFromEmail: resendFromEmail.value(),
          defaultFromName: resendFromName.value(),
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

// Export secrets for use in function definitions
export const emailSecrets = {
  resendApiKey,
  resendFromEmail,
  resendFromName,
};
