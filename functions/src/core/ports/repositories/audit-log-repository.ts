import {
  AuditLog,
  AuditLogData,
  AuditLogQueryFilters,
} from "../../entities/audit-log";

export interface AuditLogRepository {
  /**
   * Create a new audit log entry
   */
  create(orgId: string, data: AuditLogData): Promise<string>;

  /**
   * Get a single audit log entry by ID
   */
  get(orgId: string, id: string): Promise<AuditLog | null>;

  /**
   * Query audit logs with filters
   */
  query(
    orgId: string,
    filters: AuditLogQueryFilters,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    }
  ): Promise<{ logs: AuditLog[]; total: number }>;

  /**
   * Get audit logs for a specific resource
   */
  getByResource(
    orgId: string,
    resourceType: string,
    resourceId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;

  /**
   * Get audit logs for a specific user
   */
  getByUser(
    orgId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;

  /**
   * Get audit logs by action type
   */
  getByAction(
    orgId: string,
    action: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;
}

