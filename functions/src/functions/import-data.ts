import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { importService } from "../services/import-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService } from "../services/audit-log-service";
import type { ImportDataInput, ImportJobData } from "../core/entities/export-import";

/**
 * Firebase Cloud Function for importing data.
 *
 * Request payload:
 * {
 *   orgId: string,
 *   fileUrl: string (Firebase Storage URL),
 *   fileName: string,
 *   entityType: "products" | "invoices" | "contacts" | "leads" | "proposals" | "templates",
 *   mode: "create-only" | "upsert",
 *   columnMapping?: Record<string, string>, // file column → entity field
 *   options?: {
 *     skipInvalidRows?: boolean,
 *     conflictPolicy?: "skip" | "overwrite" | "merge"
 *   }
 * }
 *
 * Response: { jobId: string }
 */
export const importData = onCall<ImportDataInput, Promise<{ jobId: string }>>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540, // 9 minutes for large imports
    memory: "512MiB",
  },
  async (request) => {
    try {
      const payload = request.data;

      if (!payload) {
        throw new HttpsError("invalid-argument", "Request payload is required");
      }

      if (!payload.orgId) {
        throw new HttpsError("invalid-argument", "Organization ID (orgId) is required");
      }

      if (!payload.fileUrl) {
        throw new HttpsError("invalid-argument", "File URL is required");
      }

      if (!payload.fileName) {
        throw new HttpsError("invalid-argument", "File name is required");
      }

      if (!payload.entityType) {
        throw new HttpsError("invalid-argument", "Entity type is required");
      }

      if (!payload.mode) {
        throw new HttpsError("invalid-argument", "Import mode is required");
      }

      // Verify authentication and organization membership
      await verifyAuthAndOrgMembership(request, payload.orgId, {
        requireOwnerOrAdmin: true,
      });

      const userContext = await extractUserContextFromRequest(request);
      if (!userContext) {
        throw new HttpsError("unauthenticated", "User context is required");
      }

      loggerService.info("Creating import job", {
        orgId: payload.orgId,
        entityType: payload.entityType,
        mode: payload.mode,
        fileName: payload.fileName,
        userId: userContext.userId,
      });

      // Create import job document
      const db = getFirestore();
      const jobRef = db
        .collection("organizations")
        .doc(payload.orgId)
        .collection("importJobs")
        .doc();

      const jobData: ImportJobData = {
        orgId: payload.orgId,
        createdBy: userContext.userId,
        createdAt: new Date().toISOString(),
        status: "queued",
        entityType: payload.entityType,
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        mode: payload.mode,
        columnMapping: payload.columnMapping || {},
        stats: {
          totalRows: 0,
          validRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errorRows: 0,
        },
        options: payload.options,
      };

      await jobRef.set(jobData);

      const jobId = jobRef.id;

      // Update job status to parsing
      await jobRef.update({
        status: "parsing",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Process import
      const databaseService = getDatabaseService();

      try {
        // Update to validating
        await jobRef.update({
          status: "validating",
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update to importing
        await jobRef.update({
          status: "importing",
          updatedAt: FieldValue.serverTimestamp(),
        });

        const result = await importService.importEntities(
          payload,
          databaseService,
          userContext.userId,
        );

        // Update job with results
        await jobRef.update({
          status: "completed",
          stats: result.stats,
          errorReportUrl: result.errorReportUrl,
          updatedAt: FieldValue.serverTimestamp(),
        });

        loggerService.info("Import job completed", {
          jobId,
          orgId: payload.orgId,
          stats: result.stats,
        });

        // Create audit log entry
        try {
          if (userContext) {
            const databaseService = getDatabaseService();
            const auditLogRepository = getAuditLogRepository(databaseService);
            const auditLogService = getAuditLogService(auditLogRepository);

            await auditLogService.logSuccess(
              payload.orgId,
              "data.imported",
              userContext,
              {
                resource: {
                  type: "import_job",
                  id: jobId,
                },
                metadata: {
                  source: "api",
                  customFields: {
                    entityType: payload.entityType,
                    mode: payload.mode,
                    stats: result.stats,
                    fileName: payload.fileName,
                    hasErrors: result.errorReportUrl ? true : false,
                  },
                },
              },
            );
          }
        } catch (auditError) {
          loggerService.warn("Failed to create audit log for import", {
            error: auditError instanceof Error ? auditError.message : String(auditError),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        loggerService.error("Import job failed", {
          jobId,
          orgId: payload.orgId,
          error: errorMessage,
        });

        // Update job with error
        await jobRef.update({
          status: "failed",
          error: errorMessage,
          updatedAt: FieldValue.serverTimestamp(),
        });

        throw error;
      }

      return { jobId };
    } catch (error: any) {
      loggerService.error("Failed to create import job", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create import job: ${error.message}`,
      );
    }
  },
);
