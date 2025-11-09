import { useQuery } from "@tanstack/react-query";
import { auditLogService } from "@/services/audit-log/audit-log-service";
import { useOrganizationContext } from "@/contexts/organization-context";
import {
  AuditLogQueryFilters,
} from "@/core";

interface UseAuditLogsOptions {
  filters?: AuditLogQueryFilters;
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
  enabled?: boolean;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { currentOrganization } = useOrganizationContext();
  const {
    filters = {},
    limit = 50,
    offset = 0,
    orderBy = { field: "timestamp", direction: "desc" },
    enabled = true,
  } = options;

  return useQuery({
    queryKey: [
      "audit-logs",
      currentOrganization?.id,
      filters,
      limit,
      offset,
      orderBy,
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        throw new Error("Organization ID is required");
      }

      return auditLogService.queryAuditLogs(
        currentOrganization.id,
        filters,
        {
          limit,
          offset,
          orderBy,
        },
      );
    },
    enabled: enabled && !!currentOrganization?.id,
  });
}

/**
 * Hook to get audit logs for a specific resource
 */
export function useResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  options?: { limit?: number; enabled?: boolean },
) {
  const { currentOrganization } = useOrganizationContext();
  const { limit = 50, enabled = true } = options || {};

  return useQuery({
    queryKey: [
      "audit-logs",
      "resource",
      currentOrganization?.id,
      resourceType,
      resourceId,
      limit,
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        throw new Error("Organization ID is required");
      }

      return auditLogService.queryAuditLogs(
        currentOrganization.id,
        {
          resourceType,
          resourceId,
        },
        { limit, orderBy: { field: "timestamp", direction: "desc" } },
      );
    },
    enabled: enabled && !!currentOrganization?.id && !!resourceType && !!resourceId,
  });
}

/**
 * Hook to get audit logs for a specific user
 */
export function useUserAuditLogs(
  userId: string,
  options?: { limit?: number; enabled?: boolean },
) {
  const { currentOrganization } = useOrganizationContext();
  const { limit = 50, enabled = true } = options || {};

  return useQuery({
    queryKey: [
      "audit-logs",
      "user",
      currentOrganization?.id,
      userId,
      limit,
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        throw new Error("Organization ID is required");
      }

      return auditLogService.queryAuditLogs(
        currentOrganization.id,
        {
          userId,
        },
        { limit, orderBy: { field: "timestamp", direction: "desc" } },
      );
    },
    enabled: enabled && !!currentOrganization?.id && !!userId,
  });
}

/**
 * Hook to get audit logs by action type
 */
export function useActionAuditLogs(
  action: string,
  options?: { limit?: number; enabled?: boolean },
) {
  const { currentOrganization } = useOrganizationContext();
  const { limit = 50, enabled = true } = options || {};

  return useQuery({
    queryKey: [
      "audit-logs",
      "action",
      currentOrganization?.id,
      action,
      limit,
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        throw new Error("Organization ID is required");
      }

      return auditLogService.queryAuditLogs(
        currentOrganization.id,
        {
          action: action as any,
        },
        { limit, orderBy: { field: "timestamp", direction: "desc" } },
      );
    },
    enabled: enabled && !!currentOrganization?.id && !!action,
  });
}

