import {
  AuditLog,
  AuditLogData,
  AuditLogQueryFilters,
} from "../../entities/audit-log";

export interface AuditLogRepository {
  create(orgId: string, data: AuditLogData): Promise<string>;
  get(orgId: string, id: string): Promise<AuditLog | null>;
  query(
    orgId: string,
    filters: AuditLogQueryFilters,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    }
  ): Promise<{ logs: AuditLog[]; total: number }>;
  getByResource(
    orgId: string,
    resourceType: string,
    resourceId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;
  getByUser(
    orgId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;
  getByAction(
    orgId: string,
    action: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>;
}

