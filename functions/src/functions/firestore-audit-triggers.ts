import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getDatabaseService } from "../services/database-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService, AuditLogService } from "../services/audit-log-service";
import { loggerService } from "../services/logger-service";
import { AuditLogActionType } from "../core/entities/audit-log";

/**
 * Firestore trigger to automatically log document changes
 * This creates audit logs for all document create, update, and delete operations
 */
export const auditDocumentChanges = onDocumentWritten(
  {
    document: "organizations/{orgId}/{collection}/{docId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      // Skip audit logs collection to avoid infinite loops
      if (event.params.collection === "auditLogs") {
        return;
      }

      const orgId = event.params.orgId;
      const collection = event.params.collection;
      const docId = event.params.docId;

      const beforeData = event.data?.before?.data();
      const afterData = event.data?.after?.data();

      // Determine action type
      let action: AuditLogActionType;
      let beforeSnapshot: Record<string, unknown> | undefined;
      let afterSnapshot: Record<string, unknown> | undefined;

      if (!event.data?.before?.exists && event.data?.after?.exists) {
        // Document created
        action = `${collection}.created` as AuditLogActionType;
        afterSnapshot = afterData;
      } else if (event.data?.before?.exists && !event.data?.after?.exists) {
        // Document deleted
        action = `${collection}.deleted` as AuditLogActionType;
        beforeSnapshot = beforeData;
      } else {
        // Document updated
        action = `${collection}.updated` as AuditLogActionType;
        beforeSnapshot = beforeData;
        afterSnapshot = afterData;
      }

      // Build changes array
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
      if (beforeSnapshot && afterSnapshot) {
        const allKeys = new Set([
          ...Object.keys(beforeSnapshot),
          ...Object.keys(afterSnapshot),
        ]);

        for (const key of allKeys) {
          const oldVal = beforeSnapshot[key];
          const newVal = afterSnapshot[key];

          // Skip timestamp fields and internal fields
          if (key === "timestamp" || key === "createdAt" || key === "updatedAt") {
            continue;
          }

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({
              field: key,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }
      }

      // Get resource name from document data
      const resourceName = afterData?.name || afterData?.title || afterData?.invoiceNumber || docId;

      // Create audit log with system user context
      const databaseService = getDatabaseService();
      const auditLogRepository = getAuditLogRepository(databaseService);
      const auditLogService = getAuditLogService(auditLogRepository);

      await auditLogService.logSuccess(
        orgId,
        action,
        AuditLogService.buildUserContext(
          "system",
          "system",
          "system@firestore",
          "Firestore Trigger",
          {
            ipAddress: undefined,
            userAgent: "firestore-trigger",
          }
        ),
        {
          resource: {
            type: collection,
            id: docId,
            name: resourceName,
          },
          changes: changes.length > 0 ? changes : undefined,
          beforeSnapshot: beforeSnapshot,
          afterSnapshot: afterSnapshot,
          metadata: {
            source: "system",
            sourceDetails: `Firestore trigger: ${event.type}`,
            tags: ["automatic", "firestore"],
          },
        }
      );

      loggerService.debug("Audit log created for Firestore change", {
        orgId,
        collection,
        docId,
        action,
      });
    } catch (error) {
      // Don't throw - we don't want to break document operations
      loggerService.error("Failed to create audit log for Firestore change", {
        error: error instanceof Error ? error.message : String(error),
        orgId: event.params.orgId,
        collection: event.params.collection,
        docId: event.params.docId,
      });
    }
  }
);

