import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { validateMagicLink } from "../services/magic-link-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

interface ValidateResumeLinkPayload {
  token: string;
  organizationId?: string;
}

/**
 * Validate a magic link token and return progress information
 */
export const validateResumeLink = onCall<ValidateResumeLinkPayload>(
  {
    region: "us-central1",
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { token, organizationId } = request.data;

      if (!token) {
        throw new HttpsError("invalid-argument", "Token is required");
      }

      const result = await validateMagicLink(token);

      if (!result.valid) {
        logger.warn("Invalid magic link token", {
          token: token.substring(0, 8) + "***",
          error: result.error,
        });

        await logAuditFailureForRequest({
          request,
          operationName: "validateResumeLink",
          organizationId,
          action: "access.granted",
          error: new Error(result.error || "Invalid magic link token"),
          resource: {
            type: "magic_link",
            id: token.substring(0, 8),
          },
          metadata: {
            source: "api",
            sourceDetails: "validateResumeLink",
            customFields: {
              reason: result.error || "invalid",
            },
          },
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

      await logAuditSuccessForRequest({
        request,
        operationName: "validateResumeLink",
        organizationId,
        action: "access.granted",
        resource: result.progressId
          ? {
              type: "onboarding_progress",
              id: result.progressId,
            }
          : {
              type: "magic_link",
              id: token.substring(0, 8),
            },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "validateResumeLink",
        },
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

      const errorPayload = request.data as ValidateResumeLinkPayload;
      await logAuditFailureForRequest({
        request,
        operationName: "validateResumeLink",
        organizationId: errorPayload?.organizationId,
        action: "access.granted",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: errorPayload?.token
          ? {
              type: "magic_link",
              id: errorPayload.token.substring(0, 8),
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "validateResumeLink",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to validate resume link");
    }
  }
);
