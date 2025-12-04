import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleUploadInvoiceFile } from "../app/handle-upload-invoice-file";
import { CreateExtractionJobInput } from "../core/entities/invoice-extraction-job";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";

/**
 * Firebase Cloud Function for uploading an invoice file and creating an extraction job.
 *
 * This function:
 * 1. Validates the file upload
 * 2. Creates an extraction job with status "pending"
 * 3. Returns the extraction job ID
 *
 * Request payload:
 * {
 *   orgId: string,
 *   fileUrl: string (Firebase Storage URL),
 *   fileName: string,
 *   fileType: "pdf" | "image/jpeg" | "image/png" | "image/jpg" | "image/webp",
 *   fileSizeBytes: number
 * }
 *
 * Response: { jobId: string }
 */
export const uploadInvoiceFile = onCall<CreateExtractionJobInput, Promise<{ jobId: string }>>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const payload = request.data;

      // Basic validation
      if (!payload) {
        throw new HttpsError(
          "invalid-argument",
          "Request payload is required"
        );
      }

      if (!payload.orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID (orgId) is required"
        );
      }

      // Verify authentication and organization membership
      // Members can upload invoices (owner/admin/member roles)
      await verifyAuthAndOrgMembership(request, payload.orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

      if (!payload.fileUrl) {
        throw new HttpsError(
          "invalid-argument",
          "File URL (fileUrl) is required"
        );
      }

      if (!payload.fileName) {
        throw new HttpsError(
          "invalid-argument",
          "File name (fileName) is required"
        );
      }

      if (!payload.fileType) {
        throw new HttpsError(
          "invalid-argument",
          "File type (fileType) is required"
        );
      }

      if (!payload.fileSizeBytes || payload.fileSizeBytes <= 0) {
        throw new HttpsError(
          "invalid-argument",
          "File size (fileSizeBytes) is required and must be positive"
        );
      }

      loggerService.info("Uploading invoice file", {
        orgId: payload.orgId,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSizeBytes: payload.fileSizeBytes,
      });

      // Call application handler
      const jobId = await handleUploadInvoiceFile(payload);

      loggerService.info("Invoice file uploaded and extraction job created", {
        jobId,
        orgId: payload.orgId,
      });

      // Record usage event
      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: payload.orgId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.INVOICE_EXTRACTION_UPLOAD,
          metadata: {
            entityId: jobId,
            context: "api",
            fileType: payload.fileType,
            fileSizeBytes: payload.fileSizeBytes,
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        loggerService.warn("Failed to record usage event for invoice upload", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return { jobId };
    } catch (error: any) {
      loggerService.error("Failed to upload invoice file", {
        error: error.message,
        stack: error.stack,
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to upload invoice file: ${error.message}`
      );
    }
  }
);

