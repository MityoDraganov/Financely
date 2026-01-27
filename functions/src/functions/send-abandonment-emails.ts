import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import {
  sendAbandonmentEmail,
  findAbandonedOnboarding,
} from "../services/abandonment-email-service";
import { getDatabaseService } from "../services/database-service";

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

const databaseService = getDatabaseService();

/**
 * Track which emails have been sent to avoid duplicates
 */
interface EmailSendTracker {
  progressId: string;
  emailSentAt: string;
  emailType: "24h" | "72h" | "7d";
}

const EMAIL_TRACKER_KEY = "financely_abandonment_emails_sent";

/**
 * Check if email was already sent for this progress
 */
async function wasEmailSent(
  progressId: string,
  emailType: "24h" | "72h" | "7d"
): Promise<boolean> {
  try {
    const trackerId = `${progressId}_${emailType}`;
    const tracker = await databaseService.get<EmailSendTracker>(
      EMAIL_TRACKER_KEY,
      trackerId
    );
    return !!tracker;
  } catch {
    return false;
  }
}

/**
 * Mark email as sent
 */
async function markEmailSent(
  progressId: string,
  emailType: "24h" | "72h" | "7d"
): Promise<void> {
  try {
    const trackerId = `${progressId}_${emailType}`;
    await databaseService.set(EMAIL_TRACKER_KEY, trackerId, {
      progressId,
      emailSentAt: new Date().toISOString(),
      emailType,
    });
  } catch (error) {
    logger.error("Failed to mark email as sent", {
      progressId,
      emailType,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Scheduled function to send abandonment recovery emails
 * Runs every 6 hours
 */
export const sendAbandonmentEmails = onSchedule(
  {
    schedule: "0 */6 * * *", // Every 6 hours
    timeZone: "UTC",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async () => {
    logger.info("Starting abandonment email check");

    const appUrl = process.env.APP_URL || "https://app.financely.com";
    const config = {
      apiKey: resendApiKey.value(),
      fromEmail: resendFromEmail.value(),
      fromName: resendFromName.value(),
      appUrl,
    };

    let emailsSent = 0;
    let errors = 0;

    // Check for 24h abandonment
    const abandoned24h = await findAbandonedOnboarding(24);
    for (const progress of abandoned24h) {
      if (await wasEmailSent(progress.id, "24h")) {
        continue;
      }

      const daysSince = Math.floor(
        (Date.now() - new Date(progress.data.lastActivityAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSince >= 1 && daysSince < 3) {
        const result = await sendAbandonmentEmail(progress, config, 1);
        if (result.success) {
          await markEmailSent(progress.id, "24h");
          emailsSent++;
        } else {
          errors++;
        }
      }
    }

    // Check for 72h abandonment
    const abandoned72h = await findAbandonedOnboarding(72);
    for (const progress of abandoned72h) {
      if (await wasEmailSent(progress.id, "72h")) {
        continue;
      }

      const daysSince = Math.floor(
        (Date.now() - new Date(progress.data.lastActivityAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSince >= 3 && daysSince < 7) {
        const result = await sendAbandonmentEmail(progress, config, 3);
        if (result.success) {
          await markEmailSent(progress.id, "72h");
          emailsSent++;
        } else {
          errors++;
        }
      }
    }

    // Check for 7d abandonment
    const abandoned7d = await findAbandonedOnboarding(7 * 24);
    for (const progress of abandoned7d) {
      if (await wasEmailSent(progress.id, "7d")) {
        continue;
      }

      const daysSince = Math.floor(
        (Date.now() - new Date(progress.data.lastActivityAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSince >= 7) {
        const result = await sendAbandonmentEmail(progress, config, 7);
        if (result.success) {
          await markEmailSent(progress.id, "7d");
          emailsSent++;
        } else {
          errors++;
        }
      }
    }

    logger.info("Abandonment email check completed", {
      emailsSent,
      errors,
      checked24h: abandoned24h.length,
      checked72h: abandoned72h.length,
      checked7d: abandoned7d.length,
    });
  }
);
