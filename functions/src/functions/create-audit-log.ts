import { onCall, HttpsError } from "firebase-functions/v2/https";
import { CreateAuditLogInput } from "../core/entities/audit-log";
import { getDatabaseService } from "../services/database-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService } from "../services/audit-log-service";
import { loggerService } from "../services/logger-service";
import { AuditLogService } from "../services/audit-log-service";

/**
 * Firebase Cloud Function for creating audit log entries.
 *
 * This function allows both frontend and backend services to create audit log entries.
 * It validates the input and creates a comprehensive audit log entry.
 *
 * Request payload structure:
 * {
 *   organizationId: string,
 *   action: AuditLogActionType,
 *   user: AuditLogUserContext,
 *   resource?: AuditLogResource,
 *   changes?: AuditLogChange[],
 *   beforeSnapshot?: Record<string, unknown>,
 *   afterSnapshot?: Record<string, unknown>,
 *   metadata?: AuditLogMetadata,
 *   outcome?: Partial<AuditLogOutcome>,
 *   severity?: AuditLogSeverity
 * }
 *
 * Response: { id: string }
 */
export const createAuditLog = onCall<CreateAuditLogInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const payload = request.data;

      // Basic validation
      if (!payload) {
        throw new HttpsError(
          "invalid-argument",
          "Request payload is required"
        );
      }

      if (!payload.organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID is required"
        );
      }

      if (!payload.action) {
        throw new HttpsError(
          "invalid-argument",
          "Action is required"
        );
      }

      if (!payload.user) {
        throw new HttpsError(
          "invalid-argument",
          "User context is required"
        );
      }

      // Extract IP and user agent from request if not provided
      const userContext = {
        ...payload.user,
        ipAddress: payload.user.ipAddress || AuditLogService.extractIpAddress(request),
        userAgent: payload.user.userAgent || AuditLogService.extractUserAgent(request),
      };

      // Get services
      const databaseService = getDatabaseService();
      const auditLogRepository = getAuditLogRepository(databaseService);
      const auditLogService = getAuditLogService(auditLogRepository);

      // Create audit log entry
      const logId = await auditLogService.log(payload.organizationId, {
        ...payload,
        user: userContext,
      });

      if (!logId) {
        throw new HttpsError(
          "internal",
          "Failed to create audit log entry"
        );
      }

      loggerService.debug("Audit log created", {
        logId,
        organizationId: payload.organizationId,
        action: payload.action,
        userId: payload.user.userId,
      });

      return { id: logId };
    } catch (error: any) {
      loggerService.error("Failed to create audit log", {
        error: error.message,
        stack: error.stack,
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to create audit log: ${error.message}`
      );
    }
  }
);

