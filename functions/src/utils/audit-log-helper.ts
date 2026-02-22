import type { CallableRequest } from "firebase-functions/v2/https";
import {
  AuditLogActionType,
  AuditLogChange,
  AuditLogData,
  AuditLogResource,
  AuditLogUserContext,
} from "../core/entities/audit-log";
import { getDatabaseService } from "../services/database-service";
import { loggerService } from "../services/logger-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService } from "../services/audit-log-service";
import { extractUserContextFromRequest } from "./request-context";

interface BaseAuditLogRequestOptions {
  request: CallableRequest<unknown>;
  operationName: string;
  organizationId?: string;
  action: AuditLogActionType;
  resource?: AuditLogResource;
  metadata?: AuditLogData["metadata"];
  fallbackUserContext?: AuditLogUserContext;
}

interface AuditLogSuccessRequestOptions extends BaseAuditLogRequestOptions {
  changes?: AuditLogChange[];
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  durationMs?: number;
}

interface AuditLogFailureRequestOptions extends BaseAuditLogRequestOptions {
  error: Error | string;
  errorCode?: string;
}

async function resolveUserContext(
  request: CallableRequest<unknown>,
  fallbackUserContext?: AuditLogUserContext,
): Promise<AuditLogUserContext | null> {
  const userContext = await extractUserContextFromRequest(request);
  return userContext || fallbackUserContext || null;
}

export async function logAuditSuccessForRequest(
  options: AuditLogSuccessRequestOptions,
): Promise<void> {
  const {
    request,
    operationName,
    organizationId,
    action,
    resource,
    changes,
    beforeSnapshot,
    afterSnapshot,
    metadata,
    durationMs,
    fallbackUserContext,
  } = options;

  if (!organizationId) {
    return;
  }

  try {
    const userContext = await resolveUserContext(request, fallbackUserContext);
    if (!userContext) {
      loggerService.warn("Skipping audit log: user context unavailable", {
        operationName,
        organizationId,
        action,
      });
      return;
    }

    const databaseService = getDatabaseService();
    const auditLogRepository = getAuditLogRepository(databaseService);
    const auditLogService = getAuditLogService(auditLogRepository);

    await auditLogService.logSuccess(organizationId, action, userContext, {
      resource,
      changes,
      beforeSnapshot,
      afterSnapshot,
      metadata,
      durationMs,
    });
  } catch (auditError) {
    loggerService.warn("Failed to create audit log", {
      operationName,
      organizationId,
      action,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
  }
}

export async function logAuditFailureForRequest(
  options: AuditLogFailureRequestOptions,
): Promise<void> {
  const {
    request,
    operationName,
    organizationId,
    action,
    resource,
    metadata,
    error,
    errorCode,
    fallbackUserContext,
  } = options;

  if (!organizationId) {
    return;
  }

  try {
    const userContext = await resolveUserContext(request, fallbackUserContext);
    if (!userContext) {
      loggerService.warn("Skipping audit failure log: user context unavailable", {
        operationName,
        organizationId,
        action,
      });
      return;
    }

    const databaseService = getDatabaseService();
    const auditLogRepository = getAuditLogRepository(databaseService);
    const auditLogService = getAuditLogService(auditLogRepository);

    await auditLogService.logFailure(
      organizationId,
      action,
      userContext,
      error instanceof Error ? error : new Error(String(error)),
      {
        resource,
        metadata,
        errorCode,
      },
    );
  } catch (auditError) {
    loggerService.warn("Failed to create audit failure log", {
      operationName,
      organizationId,
      action,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
  }
}
