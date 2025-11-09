import { useUser } from "@clerk/clerk-react";
import { useOrganizationContext } from "@/contexts/organization-context";
import { auditLogService } from "@/services/audit-log/audit-log-service";
import {
  CreateAuditLogInput,
  AuditLogActionType,
  AuditLogSeverity,
} from "@/core";

/**
 * Get user context for audit logging
 * This extracts user information from Clerk and organization context
 */
export function useAuditLogContext() {
  const { user } = useUser();
  const { currentOrganization } = useOrganizationContext();

  return {
    organizationId: currentOrganization?.id,
    user: user
      ? {
          userId: user.id,
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          name:
            user.fullName ||
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
            "",
          ipAddress: undefined, // Will be extracted on backend
          userAgent: navigator.userAgent,
          sessionId: user.id, // Can be enhanced with actual session ID
        }
      : undefined,
  };
}

/**
 * Create an audit log entry from the frontend
 * This is a convenience function that automatically extracts user context
 */
export async function logAuditEvent(
  action: AuditLogActionType,
  options?: {
    organizationId?: string;
    userId?: string;
    clerkId?: string;
    email?: string;
    name?: string;
    resource?: {
      type: string;
      id: string;
      name?: string;
    };
    changes?: Array<{
      field: string;
      oldValue?: unknown;
      newValue?: unknown;
    }>;
    beforeSnapshot?: Record<string, unknown>;
    afterSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    severity?: AuditLogSeverity;
    outcome?: {
      status: "success" | "failure" | "partial";
      message?: string;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
    };
  },
): Promise<string | null> {
  try {
    if (!options?.organizationId) {
      console.warn("Cannot create audit log: organizationId is required");
      return null;
    }

    if (!options?.userId || !options?.clerkId || !options?.email || !options?.name) {
      console.warn("Cannot create audit log: user context is incomplete");
      return null;
    }

    const input: CreateAuditLogInput = {
      organizationId: options.organizationId,
      action,
      user: {
        userId: options.userId,
        clerkId: options.clerkId,
        email: options.email,
        name: options.name,
        ipAddress: undefined, // Will be extracted on backend
        userAgent: navigator.userAgent,
      },
      resource: options.resource,
      changes: options.changes,
      beforeSnapshot: options.beforeSnapshot,
      afterSnapshot: options.afterSnapshot,
      metadata: options.metadata ? {
        source: "web",
        ...options.metadata,
      } : undefined,
      severity: options.severity || "info",
      outcome: {
        status: options.outcome?.status || "success",
        message: options.outcome?.message,
        errorCode: options.outcome?.errorCode,
        errorMessage: options.outcome?.errorMessage,
        durationMs: options.outcome?.durationMs,
      },
    };

    return await auditLogService.createAuditLog(input);
  } catch (error) {
    // Don't throw errors from audit logging - log them instead
    console.error("Failed to create audit log:", error);
    return null;
  }
}

/**
 * Helper to log CRUD operations
 */
export async function logCRUDOperation(
  operation: "create" | "update" | "delete",
  resourceType: string,
  resourceId: string,
  options: {
    organizationId: string;
    userId: string;
    clerkId: string;
    email: string;
    name: string;
    resourceName?: string;
    changes?: Array<{
      field: string;
      oldValue?: unknown;
      newValue?: unknown;
    }>;
    beforeSnapshot?: Record<string, unknown>;
    afterSnapshot?: Record<string, unknown>;
  },
): Promise<string | null> {
  const actionMap: Record<string, AuditLogActionType> = {
    create: `${resourceType}.created` as AuditLogActionType,
    update: `${resourceType}.updated` as AuditLogActionType,
    delete: `${resourceType}.deleted` as AuditLogActionType,
  };

  const action = actionMap[operation];
  if (!action) {
    console.warn("Unknown CRUD operation:", operation);
    return null;
  }

  return logAuditEvent(action, {
    organizationId: options.organizationId,
    userId: options.userId,
    clerkId: options.clerkId,
    email: options.email,
    name: options.name,
    resource: {
      type: resourceType,
      id: resourceId,
      name: options.resourceName,
    },
    changes: options.changes,
    beforeSnapshot: options.beforeSnapshot,
    afterSnapshot: options.afterSnapshot,
  });
}

