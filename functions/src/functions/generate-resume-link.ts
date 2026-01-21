import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { generateMagicLink } from "../services/magic-link-service";

interface GenerateResumeLinkPayload {
  progressId: string;
  email: string;
}

/**
 * Generate a secure magic link for resuming onboarding
 */
export const generateResumeLink = onCall<GenerateResumeLinkPayload>(
  {
    region: "us-central1",
  },
  async (request) => {
    try {
      const { progressId, email } = request.data;

      if (!progressId || !email) {
        throw new HttpsError(
          "invalid-argument",
          "progressId and email are required"
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpsError("invalid-argument", "Invalid email format");
      }

      const token = await generateMagicLink(progressId, email);

      logger.info("Magic link generated", {
        progressId,
        email: email.substring(0, 3) + "***", // Log partial email for privacy
      });

      return {
        success: true,
        token,
        resumeUrl: `${process.env.APP_URL || "https://app.financely.com"}/onboarding/resume/${token}`,
      };
    } catch (error) {
      logger.error("Error generating resume link", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to generate resume link");
    }
  }
);
