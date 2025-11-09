import { onCall, HttpsError } from "firebase-functions/v2/https";
import { AuditLogQueryFilters } from "../core/entities/audit-log";
import { getDatabaseService } from "../services/database-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { loggerService } from "../services/logger-service";

interface QueryAuditLogsPayload {
  organizationId: string;
  filters: AuditLogQueryFilters;
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: { field: string; direction: "asc" | "desc" };
  };
}

interface QueryAuditLogsResponse {
  logs: Array<{
    id: string;
    [key: string]: unknown;
  }>;
  total: number;
}

/**
 * Firebase Cloud Function for querying audit logs.
 *
 * This function allows querying audit logs with various filters and pagination.
 *
 * Request payload structure:
 * {
 *   organizationId: string,
 *   filters: AuditLogQueryFilters,
 *   options?: {
 *     limit?: number,
 *     offset?: number,
 *     orderBy?: { field: string, direction: "asc" | "desc" }
 *   }
 * }
 *
 * Response: { logs: AuditLog[], total: number }
 */
export const queryAuditLogs = onCall<QueryAuditLogsPayload, Promise<QueryAuditLogsResponse>>(
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

      if (!payload.filters) {
        throw new HttpsError(
          "invalid-argument",
          "Filters are required"
        );
      }

      // Ensure organizationId in filters matches payload
      const filters = {
        ...payload.filters,
        organizationId: payload.organizationId,
      };

      // Get repository
      const databaseService = getDatabaseService();
      const auditLogRepository = getAuditLogRepository(databaseService);

      // Query audit logs
      const result = await auditLogRepository.query(
        payload.organizationId,
        filters,
        payload.options
      );

      loggerService.debug("Audit logs queried", {
        organizationId: payload.organizationId,
        count: result.logs.length,
        total: result.total,
      });

      return {
        logs: result.logs,
        total: result.total,
      };
    } catch (error: any) {
      loggerService.error("Failed to query audit logs", {
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
        `Failed to query audit logs: ${error.message}`
      );
    }
  }
);

