/**
 * Email Service Usage Examples for Firebase Functions
 * Demonstrates how to use the email service in Cloud Functions
 */

import { logger } from "firebase-functions";
import { ResendEmailService } from "./resend-email-service";
import { EmailExecutor } from "../executors/email-executor";

// Example 1: Send a simple email with secrets
export async function sendSimpleEmail(secrets: {
  resendApiKey: string;
  resendFromEmail: string;
  resendFromName: string;
}) {
  try {
    const emailService = new ResendEmailService({
      apiKey: secrets.resendApiKey,
      defaultFromEmail: secrets.resendFromEmail,
      defaultFromName: secrets.resendFromName,
    });

    const result = await emailService.sendEmail({
      to: { email: 'user@example.com', name: 'John Doe' },
      from: { email: secrets.resendFromEmail, name: secrets.resendFromName },
      subject: 'Welcome to Financely!',
      html: '<h1>Welcome!</h1><p>Thank you for joining Financely.</p>',
      text: 'Welcome! Thank you for joining Financely.',
    });

    if (result.success) {
      logger.info('Email sent successfully', { messageId: result.messageId });
    } else {
      logger.error('Failed to send email', { error: result.error });
    }

    return result;
  } catch (error) {
    logger.error('Error sending email', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Example 2: Send email with template variables
export async function sendTemplateEmail(
  secrets: {
    resendApiKey: string;
    resendFromEmail: string;
    resendFromName: string;
  },
  recipientEmail: string, 
  recipientName: string, 
  templateData: Record<string, unknown>
) {
  try {
    const emailService = new ResendEmailService({
      apiKey: secrets.resendApiKey,
      defaultFromEmail: secrets.resendFromEmail,
      defaultFromName: secrets.resendFromName,
    });

    // Simple template rendering
    const subject = `Welcome to Financely, ${recipientName}!`;
    const html = `
      <h1>Welcome ${recipientName}!</h1>
      <p>Thank you for joining Financely.</p>
      <p>Here are your account details:</p>
      <ul>
        <li>Email: ${recipientEmail}</li>
        <li>App: ${templateData.appName || 'Financely'}</li>
        <li>Dashboard: <a href="${templateData.dashboardUrl || 'https://app.financely.com'}">Access Dashboard</a></li>
      </ul>
    `;

    const result = await emailService.sendEmail({
      to: { email: recipientEmail, name: recipientName },
      from: { email: secrets.resendFromEmail, name: secrets.resendFromName },
      subject,
      html,
    });

    return result;
  } catch (error) {
    logger.error('Error sending template email', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Example 3: Send invoice notification email
export async function sendInvoiceEmail(invoiceData: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  invoiceUrl: string;
}) {
  try {
    // Note: This example needs to be updated to accept secrets parameter
    // For now, using fallback values
    const emailService = new ResendEmailService({
      apiKey: process.env.RESEND_API_KEY || 're_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY',
      defaultFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@financely.app',
      defaultFromName: process.env.RESEND_FROM_NAME || 'Financely',
    });

    const result = await emailService.sendEmail({
      to: { email: invoiceData.customerEmail, name: invoiceData.customerName },
      from: { email: process.env.RESEND_FROM_EMAIL || 'noreply@financely.app', name: process.env.RESEND_FROM_NAME || 'Financely' },
      subject: `Invoice #${invoiceData.invoiceNumber} - Payment Due`,
      html: `
        <h1>Invoice #${invoiceData.invoiceNumber}</h1>
        <p>Hello ${invoiceData.customerName},</p>
        <p>Your invoice is ready for payment.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Invoice Details</h3>
          <p><strong>Amount:</strong> ${invoiceData.amount}</p>
          <p><strong>Due Date:</strong> ${invoiceData.dueDate}</p>
          <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceData.invoiceUrl}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Invoice</a>
        </div>
        <p>If you have any questions, please contact our support team.</p>
      `,
    });

    return result;
  } catch (error) {
    logger.error('Error sending invoice email', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Example 4: Send workflow notification email
export async function sendWorkflowNotificationEmail(notificationData: {
  recipientEmail: string;
  recipientName: string;
  workflowName: string;
  status: string;
  executedAt: string;
  duration: string;
  message?: string;
  workflowUrl: string;
}) {
  try {
    // Note: This example needs to be updated to accept secrets parameter
    // For now, using fallback values
    const emailService = new ResendEmailService({
      apiKey: process.env.RESEND_API_KEY || 're_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY',
      defaultFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@financely.app',
      defaultFromName: process.env.RESEND_FROM_NAME || 'Financely',
    });

    const statusColor = notificationData.status === 'Completed' ? '#27ae60' : '#e74c3c';

    const result = await emailService.sendEmail({
      to: { email: notificationData.recipientEmail, name: notificationData.recipientName },
      from: { email: process.env.RESEND_FROM_EMAIL || 'noreply@financely.app', name: process.env.RESEND_FROM_NAME || 'Financely' },
      subject: `Workflow ${notificationData.workflowName} - ${notificationData.status}`,
      html: `
        <h1>Workflow Notification</h1>
        <p>Hello ${notificationData.recipientName},</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Workflow: ${notificationData.workflowName}</h3>
          <p><strong>Status:</strong> <span style="color: ${statusColor};">${notificationData.status}</span></p>
          <p><strong>Executed at:</strong> ${notificationData.executedAt}</p>
          <p><strong>Duration:</strong> ${notificationData.duration}</p>
          ${notificationData.message ? `<p><strong>Message:</strong> ${notificationData.message}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${notificationData.workflowUrl}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Workflow</a>
        </div>
      `,
    });

    return result;
  } catch (error) {
    logger.error('Error sending workflow notification email', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Example 5: Validate email service health
export async function checkEmailServiceHealth() {
  try {
    // Note: This example needs to be updated to accept secrets parameter
    // For now, using fallback values
    const emailService = new ResendEmailService({
      apiKey: process.env.RESEND_API_KEY || 're_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY',
      defaultFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@financely.app',
      defaultFromName: process.env.RESEND_FROM_NAME || 'Financely',
    });

    const status = await emailService.getStatus();
    
    if (status.status === 'healthy') {
      logger.info('Email service is healthy');
    } else {
      logger.error('Email service is unhealthy', { details: status.details });
    }

    return status;
  } catch (error) {
    logger.error('Error checking email service health', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Example 7: Send workflow email using EmailExecutor
export async function sendWorkflowEmail(
  secrets: {
    resendApiKey: string;
    resendFromEmail: string;
    resendFromName: string;
  },
  workflowData: Record<string, unknown>,
  emailConfig: {
    recipients: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
  }
) {
  try {
    // Initialize email executor with secrets
    const emailExecutor = new EmailExecutor({
      resendApiKey: secrets.resendApiKey,
      resendFromEmail: secrets.resendFromEmail,
      resendFromName: secrets.resendFromName,
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
    logger.error('Error sending workflow email', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}
