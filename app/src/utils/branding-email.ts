import { Organization } from "@/core";
import {
  getOrganizationLogo,
  getOrganizationName,
  getPrimaryColor,
  getSecondaryColor,
  getAccentColor,
  getEmailFromName,
  getEmailFromAddress,
  getFooterText,
} from "./branding";

export interface EmailBrandingConfig {
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  emailFromName: string;
  emailFromAddress: string;
  footerText: string;
}

/**
 * Get complete branding configuration for email templates
 */
export function getEmailBrandingConfig(organization?: Organization | null): EmailBrandingConfig {
  return {
    logoUrl: getOrganizationLogo(organization),
    companyName: getOrganizationName(organization),
    primaryColor: getPrimaryColor(organization),
    secondaryColor: getSecondaryColor(organization),
    accentColor: getAccentColor(organization),
    emailFromName: getEmailFromName(organization),
    emailFromAddress: getEmailFromAddress(organization),
    footerText: getFooterText(organization),
  };
}

/**
 * Generate HTML email template with organization branding
 */
export function generateBrandedEmailHTML(
  content: string,
  branding: EmailBrandingConfig
): string {
  const logoSection = branding.logoUrl
    ? `<tr>
         <td style="padding: 32px 24px 24px 24px; text-align: center;">
           <img src="${branding.logoUrl}" alt="${branding.companyName}" style="max-width: 200px; height: auto;" />
         </td>
       </tr>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${branding.companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${logoSection}
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; border-top: 1px solid #e5e7eb; background-color: ${branding.secondaryColor}10;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                ${branding.footerText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate styled button with brand colors
 */
export function generateBrandedButton(
  text: string,
  url: string,
  branding: EmailBrandingConfig,
  variant: "primary" | "accent" = "primary"
): string {
  const backgroundColor = variant === "primary" ? branding.primaryColor : branding.accentColor;
  const textColor = "#ffffff";

  return `
<a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: ${backgroundColor}; color: ${textColor}; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
  ${text}
</a>
  `.trim();
}

/**
 * Generate complete branded invoice email HTML
 */
export function generateInvoiceEmailHTML(
  invoiceData: {
    invoiceNumber: string;
    customerName: string;
    amount: string;
    dueDate: string;
    description?: string;
    invoiceUrl?: string;
  },
  branding: EmailBrandingConfig
): string {
  const buttonHTML = invoiceData.invoiceUrl
    ? `<p style="margin: 24px 0 0 0;">
         ${generateBrandedButton("View Invoice", invoiceData.invoiceUrl, branding)}
       </p>`
    : "";

  const content = `
<div style="color: #111827;">
  <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${branding.primaryColor};">
    Invoice #${invoiceData.invoiceNumber}
  </h1>
  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    Hello ${invoiceData.customerName},
  </p>
  <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    Your invoice is ready for payment.
  </p>
  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
      Invoice Details
    </h3>
    <table cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #6b7280; width: 120px;">Amount:</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #111827;">${invoiceData.amount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Due Date:</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #111827;">${invoiceData.dueDate}</td>
      </tr>
      ${invoiceData.description ? `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Description:</td>
        <td style="padding: 8px 0; font-size: 14px; color: #111827;">${invoiceData.description}</td>
      </tr>
      ` : ""}
    </table>
  </div>
  ${buttonHTML}
</div>
  `.trim();

  return generateBrandedEmailHTML(content, branding);
}

/**
 * Generate complete branded welcome email HTML
 */
export function generateWelcomeEmailHTML(
  welcomeData: {
    name: string;
    dashboardUrl?: string;
  },
  branding: EmailBrandingConfig
): string {
  const buttonHTML = welcomeData.dashboardUrl
    ? `<p style="margin: 24px 0 0 0;">
         ${generateBrandedButton("Get Started", welcomeData.dashboardUrl, branding)}
       </p>`
    : "";

  const content = `
<div style="color: #111827;">
  <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${branding.primaryColor};">
    Welcome ${welcomeData.name}!
  </h1>
  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    Thank you for joining ${branding.companyName}.
  </p>
  <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    Here's what you can do next:
  </p>
  <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #374151;">
    <li>Complete your profile setup</li>
    <li>Explore our features</li>
    <li>Connect with our support team if you need help</li>
  </ul>
  ${buttonHTML}
</div>
  `.trim();

  return generateBrandedEmailHTML(content, branding);
}

/**
 * Generate complete branded invite email HTML
 */
export function generateInviteEmailHTML(
  inviteData: {
    inviterName: string;
    organizationName: string;
    role: string;
    inviteLink?: string;
    expirationDate?: string;
  },
  branding: EmailBrandingConfig
): string {
  const buttonHTML = inviteData.inviteLink
    ? `<p style="margin: 24px 0 0 0;">
         ${generateBrandedButton("Accept Invitation", inviteData.inviteLink, branding)}
       </p>`
    : "";

  const expirationHTML = inviteData.expirationDate
    ? `<p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
         This invitation will expire on ${inviteData.expirationDate}
       </p>`
    : "";

  const content = `
<div style="color: #111827;">
  <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${branding.primaryColor};">
    You're Invited!
  </h1>
  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    <strong>${inviteData.inviterName}</strong> has invited you to join <strong>${inviteData.organizationName}</strong>.
  </p>
  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #374151;">
    As a ${inviteData.role}, you'll have access to:
  </p>
  <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #374151;">
    <li>Organization dashboard and tools</li>
    <li>Collaborative features</li>
    <li>Team communication channels</li>
  </ul>
  ${buttonHTML}
  ${expirationHTML}
</div>
  `.trim();

  return generateBrandedEmailHTML(content, branding);
}

