import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import type { ImportJob } from "../core/entities/export-import";

/**
 * Firebase Cloud Function for getting import job status.
 *
 * Request payload:
 * {
 *   orgId: string,
 *   jobId: string
 * }
 *
 * Response: ImportJob
 */
export const getImportJob = onCall<
  { orgId: string; jobId: string },
  Promise<ImportJob>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { orgId, jobId } = request.data;

      if (!orgId) {
        throw new HttpsError("invalid-argument", "Organization ID (orgId) is required");
      }

      if (!jobId) {
        throw new HttpsError("invalid-argument", "Job ID (jobId) is required");
      }

      // Verify authentication and organization membership
      await verifyAuthAndOrgMembership(request, orgId);

      const db = getFirestore();
      const jobDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("importJobs")
        .doc(jobId)
        .get();

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "Import job not found");
      }

      const jobData = jobDoc.data();
      if (!jobData) {
        throw new HttpsError("internal", "Failed to retrieve job data");
      }

      const job: ImportJob = {
        id: jobDoc.id,
        orgId: jobData.orgId,
        createdBy: jobData.createdBy,
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
        status: jobData.status,
        entityType: jobData.entityType,
        fileUrl: jobData.fileUrl,
        fileName: jobData.fileName,
        mode: jobData.mode,
        columnMapping: jobData.columnMapping || {},
        stats: jobData.stats || {
          totalRows: 0,
          validRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errorRows: 0,
        },
        errorReportUrl: jobData.errorReportUrl,
        error: jobData.error,
        options: jobData.options,
      };

      return job;
    } catch (error: any) {
      loggerService.error("Failed to get import job", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to get import job: ${error.message}`,
      );
    }
  },
);
