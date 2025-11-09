import {
  AuditLogRepository,
  AuditLogData,
  CreateAuditLogInput,
  AuditLogActionType,
  AuditLogUserContext,
  AuditLogResource,
  AuditLogChange,
} from "../core";
import { loggerService } from "./logger-service";

/**
 * Service for creating and managing audit logs
 */
export class AuditLogService {
  constructor(private repository: AuditLogRepository) {}

  /**
   * Create an audit log entry
   */
  async log(
    orgId: string,
    input: CreateAuditLogInput,
  ): Promise<string> {
    try {
      // Build complete audit log data
      const auditLogData: AuditLogData = {
        organizationId: orgId,
        action: input.action,
        severity: input.severity || "info",
        user: input.user,
        resource: input.resource,
        changes: input.changes,
        beforeSnapshot: input.beforeSnapshot,
        afterSnapshot: input.afterSnapshot,
        outcome: {
          status: input.outcome?.status || "success",
          message: input.outcome?.message,
          errorCode: input.outcome?.errorCode,
          errorMessage: input.outcome?.errorMessage,
          errorStack: input.outcome?.errorStack,
          durationMs: input.outcome?.durationMs,
        },
        metadata: input.metadata,
        timestamp: input.timestamp || new Date().toISOString(),
      };

      const logId = await this.repository.create(orgId, auditLogData);
      
      loggerService.debug("Audit log created", {
        logId,
        orgId,
        action: input.action,
        userId: input.user.userId,
      });

      return logId;
    } catch (error) {
      // Don't throw errors from audit logging - log them instead
      loggerService.error("Failed to create audit log", {
        error: error instanceof Error ? error.message : String(error),
        orgId,
        action: input.action,
      });
      
      // Return empty string to indicate failure without throwing
      return "";
    }
  }

  /**
   * Log a successful action
   */
  async logSuccess(
    orgId: string,
    action: AuditLogActionType,
    user: AuditLogUserContext,
    options?: {
      resource?: AuditLogResource;
      changes?: AuditLogChange[];
      beforeSnapshot?: Record<string, unknown>;
      afterSnapshot?: Record<string, unknown>;
      metadata?: AuditLogData["metadata"];
      durationMs?: number;
    },
  ): Promise<string> {
    return this.log(orgId, {
      organizationId: orgId,
      action,
      user,
      resource: options?.resource,
      changes: options?.changes,
      beforeSnapshot: options?.beforeSnapshot,
      afterSnapshot: options?.afterSnapshot,
      metadata: options?.metadata,
      outcome: {
        status: "success",
        durationMs: options?.durationMs,
      },
    });
  }

  /**
   * Log a failed action
   */
  async logFailure(
    orgId: string,
    action: AuditLogActionType,
    user: AuditLogUserContext,
    error: Error | string,
    options?: {
      resource?: AuditLogResource;
      metadata?: AuditLogData["metadata"];
      errorCode?: string;
    },
  ): Promise<string> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    return this.log(orgId, {
      organizationId: orgId,
      action,
      severity: "error",
      user,
      resource: options?.resource,
      metadata: options?.metadata,
      outcome: {
        status: "failure",
        errorMessage,
        errorStack,
        errorCode: options?.errorCode,
      },
    });
  }

  /**
   * Log a CRUD operation
   */
  async logCRUD(
    orgId: string,
    operation: "create" | "update" | "delete",
    resourceType: string,
    resourceId: string,
    user: AuditLogUserContext,
    options?: {
      resourceName?: string;
      changes?: AuditLogChange[];
      beforeSnapshot?: Record<string, unknown>;
      afterSnapshot?: Record<string, unknown>;
      metadata?: AuditLogData["metadata"];
    },
  ): Promise<string> {
    const actionMap: Record<string, AuditLogActionType> = {
      create: `${resourceType}.created` as AuditLogActionType,
      update: `${resourceType}.updated` as AuditLogActionType,
      delete: `${resourceType}.deleted` as AuditLogActionType,
    };

    const action = actionMap[operation];
    if (!action) {
      loggerService.warn("Unknown CRUD operation", { operation, resourceType });
      return "";
    }

    return this.logSuccess(orgId, action, user, {
      resource: {
        type: resourceType,
        id: resourceId,
        name: options?.resourceName,
      },
      changes: options?.changes,
      beforeSnapshot: options?.beforeSnapshot,
      afterSnapshot: options?.afterSnapshot,
      metadata: options?.metadata,
    });
  }

  /**
   * Extract user context from request/auth data
   * This is a helper to build user context from various sources
   */
  static buildUserContext(
    userId: string,
    clerkId: string,
    email: string,
    name: string,
    options?: {
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      deviceInfo?: {
        type?: "desktop" | "mobile" | "tablet" | "unknown";
        os?: string;
        browser?: string;
      };
    },
  ): AuditLogUserContext {
    return {
      userId,
      clerkId,
      email,
      name,
      role: options?.role,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      sessionId: options?.sessionId,
      deviceInfo: options?.deviceInfo,
    };
  }

  /**
   * Build change tracking from before/after objects
   */
  static buildChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fieldsToTrack?: string[],
  ): AuditLogChange[] {
    const changes: AuditLogChange[] = [];
    const fields = fieldsToTrack || Object.keys({ ...before, ...after });

    for (const field of fields) {
      const oldValue = before[field];
      const newValue = after[field];

      // Only track if values actually changed
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const dataType = this.inferDataType(newValue ?? oldValue);
        changes.push({
          field,
          oldValue,
          newValue,
          dataType,
        });
      }
    }

    return changes;
  }

  /**
   * Infer data type from value
   */
  private static inferDataType(
    value: unknown,
  ): "string" | "number" | "boolean" | "object" | "array" | "date" {
    if (value === null || value === undefined) {
      return "string";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    if (value instanceof Date) {
      return "date";
    }
    if (typeof value === "object") {
      return "object";
    }
    return typeof value as "string" | "number" | "boolean";
  }

  /**
   * Extract IP address from request
   */
  static extractIpAddress(request: {
    headers?: Record<string, string | string[] | undefined>;
    rawRequest?: {
      headers?: Record<string, string | string[] | undefined>;
    };
  }): string | undefined {
    const headers = request.headers || request.rawRequest?.headers || {};
    
    // Check common IP headers (in order of preference)
    const ipHeaders = [
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip", // Cloudflare
      "x-client-ip",
    ];

    for (const header of ipHeaders) {
      const value = headers[header];
      if (value) {
        const ip = Array.isArray(value) ? value[0] : value;
        // x-forwarded-for can contain multiple IPs, take the first one
        return ip.split(",")[0].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract user agent from request
   */
  static extractUserAgent(request: {
    headers?: Record<string, string | string[] | undefined>;
    rawRequest?: {
      headers?: Record<string, string | string[] | undefined>;
    };
  }): string | undefined {
    const headers = request.headers || request.rawRequest?.headers || {};
    const userAgent = headers["user-agent"];
    
    if (userAgent) {
      return Array.isArray(userAgent) ? userAgent[0] : userAgent;
    }

    return undefined;
  }
}

/**
 * Factory function to create audit log service
 */
export function getAuditLogService(
  repository: AuditLogRepository,
): AuditLogService {
  return new AuditLogService(repository);
}

