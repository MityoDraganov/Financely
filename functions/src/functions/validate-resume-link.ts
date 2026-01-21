import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { validateMagicLink } from "../services/magic-link-service";

interface ValidateResumeLinkPayload {
  token: string;
}

/**
 * Validate a magic link token and return progress information
 */
export const validateResumeLink = onCall<ValidateResumeLinkPayload>(
  {
    region: "us-central1",
  },
  async (request) => {
    try {
      const { token } = request.data;

      if (!token) {
        throw new HttpsError("invalid-argument", "Token is required");
      }

      const result = await validateMagicLink(token);

      if (!result.valid) {
        logger.warn("Invalid magic link token", {
          token: token.substring(0, 8) + "***",
          error: result.error,
        });

        return {
          valid: false,
          error: result.error,
        };
      }

      logger.info("Magic link validated successfully", {
        token: token.substring(0, 8) + "***",
        progressId: result.progressId,
      });

      return {
        valid: true,
        progressId: result.progressId,
        email: result.email,
      };
    } catch (error) {
      logger.error("Error validating resume link", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to validate resume link");
    }
  }
);
