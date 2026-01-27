import { ResendEmailService } from "./resend-email-service";
import { generateMagicLink } from "./magic-link-service";
import { getDatabaseService } from "./database-service";
import { OnboardingProgress } from "../core/entities/onboarding-progress";
import {
  generateAbandonmentEmailHTML,
  generateAbandonmentEmailText,
} from "../templates/abandonment-email-template";
import { logger } from "firebase-functions";

const databaseService = getDatabaseService();

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  appUrl: string;
}

/**
 * Calculate progress percentage based on current step
 */
function calculateProgressPercentage(currentStep: number, totalSteps: number = 7): number {
  return Math.round((currentStep / totalSteps) * 100);
}

/**
 * Get next step description based on current step
 */
function getNextStepDescription(currentStep: number): string {
  const steps = [
    "Welcome to Financely",
    "Choose your path",
    "Learn about benefits",
    "Create your organization",
    "Customize your branding",
    "Invite your team",
    "Join an organization",
    "Complete setup",
  ];

  if (currentStep >= steps.length) {
    return "Complete your setup";
  }

  return steps[currentStep] || "Continue onboarding";
}


/**
 * Send abandonment recovery email
 */
export async function sendAbandonmentEmail(
  progress: OnboardingProgress,
  config: EmailConfig,
  daysSinceLastActivity: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const email = progress.data.email;
    if (!email) {
      logger.warn("Cannot send abandonment email: no email in progress", {
        progressId: progress.id,
      });
      return { success: false, error: "No email address" };
    }

    // Generate magic link
    const token = await generateMagicLink(progress.id, email);
    const resumeUrl = `${config.appUrl}/onboarding/resume/${token}`;

    // Calculate progress metrics
    const progressPercentage = calculateProgressPercentage(progress.data.currentStep);
    const nextStep = getNextStepDescription(progress.data.currentStep);

    // Generate email content
    const userName = email.split("@")[0] || "there";
    const html = generateAbandonmentEmailHTML({
      userName,
      progressPercentage,
      nextStep,
      resumeUrl,
      daysSinceLastActivity,
    });

    const text = generateAbandonmentEmailText({
      userName,
      progressPercentage,
      nextStep,
      resumeUrl,
      daysSinceLastActivity,
    });

    // Determine subject based on days
    let subject: string;
    if (daysSinceLastActivity === 1) {
      subject = "You're almost there! Complete your setup in 2 minutes";
    } else if (daysSinceLastActivity === 3) {
      subject = "Don't miss out - Finish setting up your workspace";
    } else {
      subject = "Last chance - Complete your onboarding today";
    }

    // Send email
    const emailService = new ResendEmailService({
      apiKey: config.apiKey,
      defaultFromEmail: config.fromEmail,
      defaultFromName: config.fromName,
    });

    const result = await emailService.sendEmail({
      to: { email, name: userName },
      from: { email: config.fromEmail, name: config.fromName },
      subject,
      html,
      text,
    });

    logger.info("Abandonment email sent", {
      progressId: progress.id,
      email: email.substring(0, 3) + "***",
      daysSinceLastActivity,
      messageId: result.messageId,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    logger.error("Error sending abandonment email", {
      progressId: progress.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Find users who have abandoned onboarding
 */
export async function findAbandonedOnboarding(
  hoursSinceLastActivity: number
): Promise<OnboardingProgress[]> {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - hoursSinceLastActivity * 60 * 60 * 1000);
    const cutoffISO = cutoffTime.toISOString();

    // Query incomplete onboarding progress older than cutoff
    const results = await databaseService.getAllByFields<OnboardingProgress>(
      "onboardingProgress",
      [
        { field: "data.lastActivityAt", operator: "<", value: cutoffISO },
        // Only get incomplete progress (not at success step)
        { field: "data.currentStep", operator: "<", value: 7 },
      ],
      { limit: 100 }, // Process in batches
    );

    return results;
  } catch (error) {
    logger.error("Error finding abandoned onboarding", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
