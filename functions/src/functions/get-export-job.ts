import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import type { ExportJob } from "../core/entities/export-import";

/**
 * Firebase Cloud Function for getting export job status.
 *
 * Request payload:
 * {
 *   orgId: string,
 *   jobId: string
 * }
 *
 * Response: ExportJob
 */
export const getExportJob = onCall<
  { orgId: string; jobId: string },
  Promise<ExportJob>
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
        .collection("exportJobs")
        .doc(jobId)
        .get();

      if (!jobDoc.exists) {
        throw new HttpsError("not-found", "Export job not found");
      }

      const jobData = jobDoc.data();
      if (!jobData) {
        throw new HttpsError("internal", "Failed to retrieve job data");
      }

      const job: ExportJob = {
        id: jobDoc.id,
        orgId: jobData.orgId,
        createdBy: jobData.createdBy,
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
        status: jobData.status,
        entityTypes: jobData.entityTypes,
        format: jobData.format,
        fileUrl: jobData.fileUrl,
        fileSizeBytes: jobData.fileSizeBytes,
        stats: jobData.stats || {
          totalRecords: 0,
          exportedRecords: 0,
        },
        error: jobData.error,
        notifyEmail: jobData.notifyEmail !== undefined ? jobData.notifyEmail : true,
        emailRecipient: jobData.emailRecipient,
        options: jobData.options,
      };

      return job;
    } catch (error: any) {
      loggerService.error("Failed to get export job", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to get export job: ${error.message}`,
      );
    }
  },
);
