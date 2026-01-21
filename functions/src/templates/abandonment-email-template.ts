import { generateBrandedEmailHTML } from "../utils/branding-email";
import { EmailBrandingConfig } from "../utils/branding-email";

interface AbandonmentEmailData {
  userName: string;
  progressPercentage: number;
  nextStep: string;
  resumeUrl: string;
  daysSinceLastActivity: number;
}

/**
 * Generate abandonment recovery email HTML
 */
export function generateAbandonmentEmailHTML(
  data: AbandonmentEmailData,
  branding?: EmailBrandingConfig
): string {
  const defaultBranding: EmailBrandingConfig = {
    logoUrl: null,
    companyName: "Financely",
    primaryColor: "#166534",
    secondaryColor: "#6b7280",
    accentColor: "#22c55e",
    emailFromName: "Financely",
    emailFromAddress: "noreply@financely.app",
    footerText: `© ${new Date().getFullYear()} Financely. All rights reserved.`,
  };

  const config = branding || defaultBranding;

  // Determine email copy based on days since last activity
  let subject: string;
  let headline: string;
  let bodyText: string;
  let ctaText: string;

  if (data.daysSinceLastActivity === 1) {
    subject = "You're almost there! Complete your setup in 2 minutes";
    headline = `Hi ${data.userName}, you're almost there!`;
    bodyText = `You're ${data.progressPercentage}% done setting up your Financely workspace. Complete your setup in just 2 minutes and start managing your finances like a pro.`;
    ctaText = "Continue Setup";
  } else if (data.daysSinceLastActivity === 3) {
    subject = "Don't miss out - Finish setting up your workspace";
    headline = `Hi ${data.userName}, don't miss out!`;
    bodyText = `You started setting up Financely ${data.daysSinceLastActivity} days ago and you're ${data.progressPercentage}% complete. Finish your setup now and unlock the full power of automated finance management.`;
    ctaText = "Finish Setup";
  } else {
    subject = "Last chance - Complete your onboarding today";
    headline = `Hi ${data.userName}, this is your last chance!`;
    bodyText = `You're ${data.progressPercentage}% done with your Financely setup. Complete it today to start streamlining your finance operations.`;
    ctaText = "Complete Setup";
  }

  const content = `
    <tr>
      <td style="padding: 32px 24px;">
        <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">
          ${headline}
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
          ${bodyText}
        </p>
        
        <!-- Progress indicator -->
        <div style="margin: 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 14px; font-weight: 500; color: #374151;">Progress</span>
            <span style="font-size: 14px; font-weight: 600; color: ${config.primaryColor};">${data.progressPercentage}%</span>
          </div>
          <div style="width: 100%; height: 8px; background-color: #e5e7eb; border-radius: 4px; overflow: hidden;">
            <div style="width: ${data.progressPercentage}%; height: 100%; background-color: ${config.primaryColor}; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
          Next step: ${data.nextStep}
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="${data.resumeUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${config.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                ${ctaText}
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback text link for email clients that don't support buttons -->
        <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
          Or copy and paste this link into your browser:<br>
          <a href="${data.resumeUrl}" style="color: ${config.primaryColor}; text-decoration: underline; word-break: break-all;">${data.resumeUrl}</a>
        </p>
      </td>
    </tr>
  `;

  return generateBrandedEmailHTML(content, config);
}

/**
 * Generate plain text version of abandonment email
 */
export function generateAbandonmentEmailText(data: AbandonmentEmailData): string {
  let subject: string;
  let bodyText: string;

  if (data.daysSinceLastActivity === 1) {
    subject = "You're almost there! Complete your setup in 2 minutes";
    bodyText = `Hi ${data.userName}, you're ${data.progressPercentage}% done setting up your Financely workspace. Complete your setup in just 2 minutes and start managing your finances like a pro.`;
  } else if (data.daysSinceLastActivity === 3) {
    subject = "Don't miss out - Finish setting up your workspace";
    bodyText = `Hi ${data.userName}, you started setting up Financely ${data.daysSinceLastActivity} days ago and you're ${data.progressPercentage}% complete. Finish your setup now and unlock the full power of automated finance management.`;
  } else {
    subject = "Last chance - Complete your onboarding today";
    bodyText = `Hi ${data.userName}, you're ${data.progressPercentage}% done with your Financely setup. Complete it today to start streamlining your finance operations.`;
  }

  return `
${subject}

${bodyText}

Progress: ${data.progressPercentage}%
Next step: ${data.nextStep}

Continue your setup: ${data.resumeUrl}

---
© ${new Date().getFullYear()} Financely. All rights reserved.
  `.trim();
}
