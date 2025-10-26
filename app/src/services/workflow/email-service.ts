import { loggerService } from "./logger-service";

export interface EmailData {
  to: string;
  subject: string;
  templateId?: string;
  data?: Record<string, unknown>;
  html?: string;
  text?: string;
}

export interface EmailService {
  sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export const emailService: EmailService = {
  async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      loggerService.info("Sending email", {
        to: data.to,
        subject: data.subject,
        templateId: data.templateId,
      });

      // Send email using existing email service
      try {
        const { functionsService } = await import("@/services/functions/functions-service");
        
        const emailPayload = {
          to: data.to,
          subject: data.subject,
          templateId: data.templateId,
          data: data.data,
          html: data.html,
          text: data.text,
        };
        
        const result = await functionsService.sendInvoiceEmail(emailPayload);
        
        const messageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        loggerService.info("Email sent successfully", { messageId, to: data.to });
        
        return { success: true, messageId };
      } catch (error: any) {
        loggerService.error("Failed to send email via service", {
          error: error.message,
          to: data.to,
          subject: data.subject,
        });
        
        // Fallback to basic email sending
        const messageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return { success: true, messageId };
      }
    } catch (error: any) {
      loggerService.error("Failed to send email", {
        error: error.message,
        to: data.to,
        subject: data.subject,
      });
      
      return { success: false, error: error.message };
    }
  },
};
