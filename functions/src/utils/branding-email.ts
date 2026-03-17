import { Organization } from "../core/entities/organization";
import { APP_ORIGIN } from "../config/app-url";

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

function getOrganizationLogo(organization?: Organization | null): string | null {
  if (organization?.settings?.branding?.customLogo) {
    return organization.settings.branding.customLogo;
  }
  if (organization?.logoUrl) {
    return organization.logoUrl;
  }
  return null;
}

function getOrganizationName(organization?: Organization | null): string {
  if (organization?.settings?.branding?.companyName) {
    return organization.settings.branding.companyName;
  }
  return "Financely";
}

function getPrimaryColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.primary || "#2563eb";
}

function getSecondaryColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.secondary || "#6b7280";
}

function getAccentColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.accent || "#10b981";
}

function getEmailFromName(organization?: Organization | null): string {
  if (organization?.settings?.branding?.emailFromName) {
    return organization.settings.branding.emailFromName;
  }
  return getOrganizationName(organization);
}

function getEmailFromAddress(organization?: Organization | null): string {
  if (organization?.settings?.branding?.emailFromAddress) {
    return organization.settings.branding.emailFromAddress;
  }
  return "noreply@financely.app";
}

function getFooterText(organization?: Organization | null): string {
  if (organization?.settings?.branding?.footerText) {
    return organization.settings.branding.footerText;
  }
  return `© ${new Date().getFullYear()} ${getOrganizationName(organization)}. All rights reserved.`;
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
    inviterEmail?: string;
    organizationName: string;
    organizationLogoUrl?: string | null;
    role: string;
    inviteLink?: string;
    expirationDate?: string;
  },
  branding: EmailBrandingConfig
): string {
  const roleLabel =
    inviteData.role.charAt(0).toUpperCase() +
    inviteData.role.slice(1).toLowerCase();

  const orgInitial = inviteData.organizationName.charAt(0).toUpperCase();
  const inviterInitial = inviteData.inviterName.charAt(0).toUpperCase();

  // Firebase Storage URLs contain bare `&` (e.g. `?alt=media&token=…`).
  // In HTML attributes `&` must be `&amp;` — Gmail's strict parser drops
  // the entire src attribute if it finds an unencoded ampersand.
  const safeLogoUrl = inviteData.organizationLogoUrl?.replace(/&/g, "&amp;");

  const orgLogoSection = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${inviteData.organizationName}" width="64" height="64"
         style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 2px solid #e5e7eb; display: block; margin: 0 auto;" />`
    : `<div style="width: 64px; height: 64px; border-radius: 12px; background-color: ${branding.primaryColor};
         color: #ffffff; font-size: 26px; font-weight: 700; line-height: 64px; text-align: center;
         display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">${orgInitial}</div>`;

  const expirationSection = inviteData.expirationDate
    ? `<p style="margin: 20px 0 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
         &#x23F0;&nbsp; This invitation expires on <strong style="color: #6b7280;">${inviteData.expirationDate}</strong>
       </p>`
    : "";

  const ctaSection = inviteData.inviteLink
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
         <tr>
           <td style="border-radius: 8px; background-color: ${branding.primaryColor};">
             <a href="${inviteData.inviteLink}"
                style="display: inline-block; padding: 14px 36px; background-color: ${branding.primaryColor};
                       color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;
                       font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                       letter-spacing: 0.01em;">
               Accept Invitation
             </a>
           </td>
         </tr>
       </table>
       ${expirationSection}`
    : expirationSection;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${branding.companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <!-- Top accent bar -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr><td style="height: 4px; background-color: ${branding.primaryColor};"></td></tr>
  </table>

  <!-- Financely header -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
    <tr>
      <td style="padding: 18px 40px; max-width: 600px; margin: 0 auto;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="${APP_ORIGIN}/financely-f.svg"
                         alt="Financely" width="32" height="32"
                         style="width: 32px; height: 32px; border-radius: 6px; display: block;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 18px; font-weight: 800; color: #1a7a3c;
                                 letter-spacing: -0.5px;">Financely</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right;">
              <span style="font-size: 12px; color: #9ca3af;">Team Invitation</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Main content wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding: 40px 20px;">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
               style="margin: 0 auto; background-color: #ffffff; border-radius: 16px;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);
                      overflow: hidden;">

          <!-- Hero section: org identity -->
          <tr>
            <td style="padding: 48px 40px 36px; text-align: center;
                       background: linear-gradient(160deg, ${branding.primaryColor}08 0%, #ffffff 60%);">
              ${orgLogoSection}
              <p style="margin: 20px 0 6px 0; font-size: 14px; font-weight: 500; color: #9ca3af;
                         text-transform: uppercase; letter-spacing: 0.08em;">You're invited to join</p>
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">
                ${inviteData.organizationName}
              </h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height: 1px; background-color: #f3f4f6;"></td></tr>

          <!-- Inviter card -->
          <tr>
            <td style="padding: 28px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="width: 48px; vertical-align: top;">
                          <div style="width: 44px; height: 44px; border-radius: 50%;
                                      background-color: ${branding.primaryColor}20;
                                      color: ${branding.primaryColor}; font-size: 18px; font-weight: 700;
                                      line-height: 44px; text-align: center; display: inline-block;">${inviterInitial}</div>
                        </td>
                        <td style="padding-left: 14px; vertical-align: middle;">
                          <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: #111827;">
                            ${inviteData.inviterName}
                          </p>
                          ${inviteData.inviterEmail
                            ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">${inviteData.inviterEmail}</p>`
                            : ""}
                          <p style="margin: 0; font-size: 13px; color: #6b7280;">
                            invited you as&nbsp;
                            <span style="display: inline-block; padding: 2px 10px; background-color: ${branding.primaryColor}15;
                                         color: ${branding.primaryColor}; border-radius: 20px; font-weight: 600;
                                         font-size: 12px; letter-spacing: 0.02em;">${roleLabel}</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What you get access to -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #374151;
                         text-transform: uppercase; letter-spacing: 0.06em;">What you'll have access to</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                ${[
                  ["Invoices & Quotes", "Create, send, and track professional invoices"],
                  ["Financial Reports", "Real-time analytics, P&L, and cash flow insights"],
                  ["Client Management", "Contacts, deal pipelines, and document history"],
                  ["Workflow Automation", "Automate recurring tasks and approvals"],
                ]
                  .map(
                    ([title, desc]) => `
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 28px;">
                    <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%;
                                 background-color: ${branding.primaryColor}15; color: ${branding.primaryColor};
                                 text-align: center; line-height: 20px; font-size: 12px; font-weight: 700;">&#10003;</span>
                  </td>
                  <td style="padding: 8px 0 8px 8px; vertical-align: top;">
                    <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: #111827;">${title}</p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4;">${desc}</p>
                  </td>
                </tr>`
                  )
                  .join("")}
              </table>
            </td>
          </tr>

          <!-- CTA section -->
          <tr>
            <td style="padding: 0 40px 48px; text-align: center;">
              ${ctaSection}
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
               style="margin: 24px auto 0;">
          <tr>
            <td style="padding: 0 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">
                Sent via
                <img src="${APP_ORIGIN}/financely-f.svg"
                     alt="" width="14" height="14"
                     style="width: 14px; height: 14px; border-radius: 3px; vertical-align: middle; display: inline-block; margin: 0 2px 1px;" />
                <a href="${APP_ORIGIN}" style="color: #1a7a3c; text-decoration: none; font-weight: 600;">Financely</a>
                &nbsp;&middot;&nbsp; The financial platform for modern teams
              </p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db; line-height: 1.6;">
                ${branding.footerText}
                <br>If you didn't expect this invitation, you can safely ignore this email.
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
