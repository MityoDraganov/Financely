import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure";
import {
  CreateAuditLogInput,
  AuditLog,
  AuditLogQueryFilters,
} from "@/core";

interface QueryAuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

/**
 * Frontend service for audit log operations
 */
export const auditLogService = {
  /**
   * Create an audit log entry
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<string> {
    const functions = getFunctions(firebase.app);
    const createAuditLogFn = httpsCallable<
      CreateAuditLogInput,
      { id: string }
    >(functions, "createAuditLog");

    const result = await createAuditLogFn(input);
    return result.data.id;
  },

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(
    organizationId: string,
    filters: AuditLogQueryFilters,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const functions = getFunctions(firebase.app);
    const queryAuditLogsFn = httpsCallable<
      {
        organizationId: string;
        filters: AuditLogQueryFilters;
        options?: {
          limit?: number;
          offset?: number;
          orderBy?: { field: string; direction: "asc" | "desc" };
        };
      },
      QueryAuditLogsResponse
    >(functions, "queryAuditLogs");

    const result = await queryAuditLogsFn({
      organizationId,
      filters,
      options,
    });

    return result.data;
  },
};

