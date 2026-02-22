import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { generateMagicLink } from "../services/magic-link-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

interface GenerateResumeLinkPayload {
  progressId: string;
  email: string;
  organizationId?: string;
}

/**
 * Generate a secure magic link for resuming onboarding
 */
export const generateResumeLink = onCall<GenerateResumeLinkPayload>(
  {
    region: "us-central1",
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { progressId, email, organizationId } = request.data;

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
      const resumeUrl = `${process.env.APP_URL || "https://app.financely.com"}/onboarding/resume/${token}`;

      logger.info("Magic link generated", {
        progressId,
        email: email.substring(0, 3) + "***", // Log partial email for privacy
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "generateResumeLink",
        organizationId,
        action: "access.granted",
        resource: {
          type: "onboarding_progress",
          id: progressId,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "generateResumeLink",
          customFields: {
            emailDomain: email.split("@")[1] || null,
          },
        },
      });

      return {
        success: true,
        token,
        resumeUrl,
      };
    } catch (error) {
      logger.error("Error generating resume link", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      const errorPayload = request.data as GenerateResumeLinkPayload;
      await logAuditFailureForRequest({
        request,
        operationName: "generateResumeLink",
        organizationId: errorPayload?.organizationId,
        action: "access.granted",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: errorPayload?.progressId
          ? {
              type: "onboarding_progress",
              id: errorPayload.progressId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "generateResumeLink",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to generate resume link");
    }
  }
);
