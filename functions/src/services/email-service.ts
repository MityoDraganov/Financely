import Mailgun from "mailgun.js";
import FormData from "form-data";
import { defineSecret } from "firebase-functions/params";

// Define secrets
const mailgunApiKey = defineSecret("MAILGUN_API_KEY");
const mailgunDomain = defineSecret("MAILGUN_DOMAIN");
const mailgunFromEmail = defineSecret("MAILGUN_FROM_EMAIL");
const mailgunFromName = defineSecret("MAILGUN_FROM_NAME");

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface InviteEmailData {
  inviteeEmail: string;
  inviteeName?: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
}

export interface WelcomeEmailData {
  userEmail: string;
  userName: string;
  organizationName: string;
  dashboardUrl: string;
}

export class EmailService {
  private static instance: EmailService;
  private initialized: boolean = false;
  private mailgun: any;

  private constructor() {
    // Constructor is empty - all initialization happens at runtime
  }

  private initialize() {
    if (!this.initialized) {
      const mailgun = new Mailgun(FormData);
      this.mailgun = mailgun.client({
        username: "api",
        key: mailgunApiKey.value(),
      });
      this.initialized = true;
    }
  }

  private getFromEmail(): string {
    return mailgunFromEmail.value() || "noreply@financely.app";
  }

  private getFromName(): string {
    return mailgunFromName.value() || "Financely";
  }

  private getDomain(): string {
    return mailgunDomain.value() || "sandbox1e91db7032524bca84d09d07d08a94e0.mailgun.org";
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendInviteEmail(data: InviteEmailData): Promise<void> {
    this.initialize();
    
    const template = this.getInviteEmailTemplate(data);
    
    const msg = {
      from: `${this.getFromName()} <${this.getFromEmail()}>`,
      to: [data.inviteeEmail],
      subject: template.subject,
      text: template.text,
      html: template.html,
    };

    try {
      const response = await this.mailgun.messages.create(this.getDomain(), msg);
      console.log(`Invite email sent successfully to ${data.inviteeEmail}`, response);
    } catch (error) {
      console.error("Error sending invite email:", error);
      throw new Error(`Failed to send invite email: ${error}`);
    }
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    this.initialize();
    
    const template = this.getWelcomeEmailTemplate(data);
    
    const msg = {
      from: `${this.getFromName()} <${this.getFromEmail()}>`,
      to: [data.userEmail],
      subject: template.subject,
      text: template.text,
      html: template.html,
    };

    try {
      const response = await this.mailgun.messages.create(this.getDomain(), msg);
      console.log(`Welcome email sent successfully to ${data.userEmail}`, response);
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw new Error(`Failed to send welcome email: ${error}`);
    }
  }

  private getInviteEmailTemplate(data: InviteEmailData): EmailTemplate {
    const subject = `You've been invited to join ${data.organizationName} on Financely`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to ${data.organizationName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #166534 0%, #22c55e 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .invite-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .invite-details h3 { margin: 0 0 10px 0; color: #166534; font-size: 18px; }
          .invite-details p { margin: 5px 0; color: #666; }
          .cta-button { display: inline-block; background: #166534; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .cta-button:hover { background: #14532d; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .logo { width: 40px; height: 40px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Join your team on Financely</p>
          </div>
          <div class="content">
            <p>Hi ${data.inviteeName || 'there'},</p>
            <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on Financely as a <strong>${data.role}</strong>.</p>
            
            <div class="invite-details">
              <h3>Invitation Details</h3>
              <p><strong>Organization:</strong> ${data.organizationName}</p>
              <p><strong>Your Role:</strong> ${data.role}</p>
              <p><strong>Invited by:</strong> ${data.inviterName}</p>
            </div>
            
            <p>Financely helps teams manage invoices, create professional documents, and streamline financial workflows.</p>
            
            <div style="text-align: center;">
              <a href="${data.inviteUrl}" class="cta-button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This invitation will expire in 7 days. If you don't have a Financely account, you'll be able to create one when you accept the invitation.
            </p>
          </div>
          <div class="footer">
            <p>This invitation was sent by Financely. If you weren't expecting this invitation, you can safely ignore this email.</p>
            <p>© 2024 Financely. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${data.inviteeName || 'there'},

${data.inviterName} has invited you to join ${data.organizationName} on Financely as a ${data.role}.

Organization: ${data.organizationName}
Your Role: ${data.role}
Invited by: ${data.inviterName}

Financely helps teams manage invoices, create professional documents, and streamline financial workflows.

To accept this invitation, click the link below:
${data.inviteUrl}

This invitation will expire in 7 days. If you don't have a Financely account, you'll be able to create one when you accept the invitation.

If you weren't expecting this invitation, you can safely ignore this email.

© 2024 Financely. All rights reserved.
    `;

    return { subject, html, text };
  }

  private getWelcomeEmailTemplate(data: WelcomeEmailData): EmailTemplate {
    const subject = `Welcome to ${data.organizationName} on Financely!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Financely</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #166534 0%, #22c55e 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .welcome-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .welcome-details h3 { margin: 0 0 10px 0; color: #166534; font-size: 18px; }
          .welcome-details p { margin: 5px 0; color: #666; }
          .cta-button { display: inline-block; background: #166534; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .cta-button:hover { background: #14532d; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .features { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
          .feature { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px; }
          .feature h4 { margin: 0 0 10px 0; color: #166534; }
          .feature p { margin: 0; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Financely!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You're now part of ${data.organizationName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.userName},</p>
            <p>Welcome to <strong>${data.organizationName}</strong> on Financely! We're excited to have you on the team.</p>
            
            <div class="welcome-details">
              <h3>What's Next?</h3>
              <p>You can now access your organization's dashboard and start collaborating with your team.</p>
            </div>
            
            <div class="features">
              <div class="feature">
                <h4>📄 Create Invoices</h4>
                <p>Design professional invoices with our drag-and-drop editor</p>
              </div>
              <div class="feature">
                <h4>🎨 Custom Templates</h4>
                <p>Create reusable templates for consistent branding</p>
              </div>
              <div class="feature">
                <h4>👥 Team Collaboration</h4>
                <p>Work together in real-time with your team members</p>
              </div>
              <div class="feature">
                <h4>📊 Analytics</h4>
                <p>Track your financial performance with detailed reports</p>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${data.dashboardUrl}" class="cta-button">Go to Dashboard</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Need help getting started? Check out our <a href="https://financely.app/docs" style="color: #166534;">documentation</a> or reach out to our support team.
            </p>
          </div>
          <div class="footer">
            <p>Welcome to the Financely family! We're here to help you succeed.</p>
            <p>© 2024 Financely. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${data.userName},

Welcome to ${data.organizationName} on Financely! We're excited to have you on the team.

What's Next?
You can now access your organization's dashboard and start collaborating with your team.

Key Features:
• Create Invoices - Design professional invoices with our drag-and-drop editor
• Custom Templates - Create reusable templates for consistent branding  
• Team Collaboration - Work together in real-time with your team members
• Analytics - Track your financial performance with detailed reports

Get started: ${data.dashboardUrl}

Need help getting started? Check out our documentation at https://financely.app/docs or reach out to our support team.

Welcome to the Financely family! We're here to help you succeed.

© 2024 Financely. All rights reserved.
    `;

    return { subject, html, text };
  }
}

export const emailService = EmailService.getInstance();
