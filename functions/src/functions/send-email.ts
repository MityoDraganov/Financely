/**
 * Firebase Function for sending emails using Resend with Secret Manager
 * Demonstrates proper integration with Google Cloud Secret Manager
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { ResendEmailService } from "../services/resend-email-service";
import { EmailExecutor } from "../executors/email-executor";
import { logger } from "firebase-functions";

// Define secrets using Firebase Functions Secret Manager
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendEmailPayload {
  to: string;
  toName?: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

interface SendTemplateEmailPayload {
  templateType: 'welcome' | 'invite' | 'invoice' | 'workflow';
  to: string;
  toName?: string;
  templateData: Record<string, unknown>;
}

export const sendEmail = onCall<SendEmailPayload>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    try {
      const { to, toName, subject, html, text, cc, bcc, replyTo } = request.data;

      // Validate required fields
      if (!to || !subject || (!html && !text)) {
        throw new HttpsError("invalid-argument", "Missing required fields: to, subject, and content");
      }

      // Initialize email service with secrets
      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      // Send email
      const result = await emailService.sendEmail({
        to: { email: to, name: toName },
        from: { email: resendFromEmail.value(), name: resendFromName.value() },
        subject,
        html,
        text,
        cc: cc?.map(email => ({ email })),
        bcc: bcc?.map(email => ({ email })),
        replyTo: replyTo ? { email: replyTo } : undefined,
      });

      logger.info("Email sent successfully", {
        to,
        subject,
        messageId: result.messageId,
        success: result.success,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      logger.error("Error sending email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send email");
    }
  }
);

export const sendTemplateEmail = onCall<SendTemplateEmailPayload>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    try {
      const { templateType, to, toName, templateData } = request.data;

      // Validate required fields
      if (!to || !templateType || !templateData) {
        throw new HttpsError("invalid-argument", "Missing required fields: to, templateType, and templateData");
      }

      // Initialize email service with secrets
      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      // Generate email content based on template type
      let subject: string;
      let html: string;
      let text: string;

      switch (templateType) {
        case 'welcome':
          subject = `Welcome to ${templateData.appName || 'Financely'}, ${templateData.name || 'User'}!`;
          html = `
            <h1>Welcome ${templateData.name || 'User'}!</h1>
            <p>Thank you for joining ${templateData.appName || 'Financely'}.</p>
            <p>Here's what you can do next:</p>
            <ul>
              <li>Complete your profile setup</li>
              <li>Explore our features</li>
              <li>Connect with our support team if you need help</li>
            </ul>
            ${templateData.dashboardUrl ? `<p><a href="${templateData.dashboardUrl}">Get Started</a></p>` : ''}
          `;
          text = `Welcome ${templateData.name || 'User'}! Thank you for joining ${templateData.appName || 'Financely'}.`;
          break;

        case 'invite':
          subject = `You're invited to join ${templateData.organizationName || 'our organization'}`;
          html = `
            <h1>You're Invited!</h1>
            <p><strong>${templateData.inviterName || 'Someone'}</strong> has invited you to join <strong>${templateData.organizationName || 'our organization'}</strong>.</p>
            <p>As a ${templateData.role || 'member'}, you'll have access to:</p>
            <ul>
              <li>Organization dashboard and tools</li>
              <li>Collaborative features</li>
              <li>Team communication channels</li>
            </ul>
            ${templateData.inviteLink ? `<p><a href="${templateData.inviteLink}">Accept Invitation</a></p>` : ''}
            ${templateData.expirationDate ? `<p>This invitation will expire on ${templateData.expirationDate}</p>` : ''}
          `;
          text = `You're invited! ${templateData.inviterName || 'Someone'} has invited you to join ${templateData.organizationName || 'our organization'}.`;
          break;

        case 'invoice':
          subject = `Invoice #${templateData.invoiceNumber || 'N/A'} - Payment Due`;
          html = `
            <h1>Invoice #${templateData.invoiceNumber || 'N/A'}</h1>
            <p>Hello ${templateData.customerName || 'Customer'},</p>
            <p>Your invoice is ready for payment.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Invoice Details</h3>
              <p><strong>Amount:</strong> ${templateData.amount || 'N/A'}</p>
              <p><strong>Due Date:</strong> ${templateData.dueDate || 'N/A'}</p>
              <p><strong>Description:</strong> ${templateData.description || 'N/A'}</p>
            </div>
            ${templateData.invoiceUrl ? `<p><a href="${templateData.invoiceUrl}">View Invoice</a></p>` : ''}
          `;
          text = `Invoice #${templateData.invoiceNumber || 'N/A'} - Amount: ${templateData.amount || 'N/A'}, Due: ${templateData.dueDate || 'N/A'}`;
          break;

        case 'workflow':
          subject = `Workflow ${templateData.workflowName || 'Notification'} - ${templateData.status || 'Completed'}`;
          html = `
            <h1>Workflow Notification</h1>
            <p>Workflow: ${templateData.workflowName || 'Unknown'}</p>
            <p><strong>Status:</strong> ${templateData.status || 'Completed'}</p>
            <p><strong>Executed at:</strong> ${templateData.executedAt || 'N/A'}</p>
            <p><strong>Duration:</strong> ${templateData.duration || 'N/A'}</p>
            ${templateData.message ? `<p><strong>Message:</strong> ${templateData.message}</p>` : ''}
            ${templateData.workflowUrl ? `<p><a href="${templateData.workflowUrl}">View Workflow</a></p>` : ''}
          `;
          text = `Workflow ${templateData.workflowName || 'Unknown'}: ${templateData.status || 'Completed'}`;
          break;

        default:
          throw new HttpsError("invalid-argument", `Unsupported template type: ${templateType}`);
      }

      // Send email
      const result = await emailService.sendEmail({
        to: { email: to, name: toName },
        from: { email: resendFromEmail.value(), name: resendFromName.value() },
        subject,
        html,
        text,
      });

      logger.info("Template email sent successfully", {
        templateType,
        to,
        subject,
        messageId: result.messageId,
        success: result.success,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      logger.error("Error sending template email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send template email");
    }
  }
);

export const sendWorkflowEmail = onCall<{
  workflowData: Record<string, unknown>;
  emailConfig: {
    recipients: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  };
}>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    try {
      const { workflowData, emailConfig } = request.data;

      // Initialize email executor with secrets
      const emailExecutor = new EmailExecutor({
        resendApiKey: resendApiKey.value(),
        resendFromEmail: resendFromEmail.value(),
        resendFromName: resendFromName.value(),
      });

      // Create mock action for the executor
      const mockAction = {
        id: `workflow_email_${Date.now()}`,
        config: emailConfig,
      };

      // Execute email sending
      const result = await emailExecutor.execute(mockAction, workflowData, `workflow_${Date.now()}`);

      logger.info("Workflow email sent successfully", {
        workflowData: Object.keys(workflowData),
        emailConfig: {
          recipientCount: emailConfig.recipients?.length || 0,
          subject: emailConfig.subject,
        },
        result: {
          success: result.success,
          messageId: result.messageId,
        },
      });

      return result;
    } catch (error) {
      logger.error("Error sending workflow email", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to send workflow email");
    }
  }
);
