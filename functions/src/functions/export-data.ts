import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { exportService } from "../services/export-service";
import { ResendEmailService } from "../services/resend-email-service";
import type { ExportDataInput, ExportJobData } from "../core/entities/export-import";
import { logAuditSuccessForRequest } from "../utils/audit-log-helper";

// Define secrets for email service
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

/**
 * Firebase Cloud Function for exporting data.
 *
 * Request payload:
 * {
 *   orgId: string,
 *   entityTypes: ("products" | "invoices" | "contacts" | "leads" | "proposals" | "templates")[],
 *   format: "csv" | "xls" | "xlsx",
 *   options?: {
 *     dateRange?: { start: string, end: string },
 *     status?: string[],
 *     includeArchived?: boolean
 *   }
 * }
 *
 * Response: { jobId: string }
 */
export const exportData = onCall<ExportDataInput, Promise<{ jobId: string }>>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540, // 9 minutes for large exports
    memory: "512MiB",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
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

      if (!payload.entityTypes || payload.entityTypes.length === 0) {
        throw new HttpsError("invalid-argument", "At least one entity type is required");
      }

      if (!payload.format) {
        throw new HttpsError("invalid-argument", "Format is required");
      }

      // Verify authentication and organization membership
      await verifyAuthAndOrgMembership(request, payload.orgId, {
        requireOwnerOrAdmin: true,
      });

      const userContext = await extractUserContextFromRequest(request);
      if (!userContext) {
        throw new HttpsError("unauthenticated", "User context is required");
      }

      loggerService.info("Creating export job", {
        orgId: payload.orgId,
        entityTypes: payload.entityTypes,
        format: payload.format,
        userId: userContext.userId,
      });

      // Create export job document
      const db = getFirestore();
      const jobRef = db
        .collection("organizations")
        .doc(payload.orgId)
        .collection("exportJobs")
        .doc();

      const jobData: ExportJobData = {
        orgId: payload.orgId,
        createdBy: userContext.userId,
        createdAt: new Date().toISOString(),
        status: "queued",
        entityTypes: payload.entityTypes,
        format: payload.format,
        stats: {
          totalRecords: 0,
          exportedRecords: 0,
        },
        notifyEmail: payload.notifyEmail !== undefined ? payload.notifyEmail : true, // Default to true
        emailRecipient: payload.emailRecipient || userContext.email, // Use provided email or default to user's email
        options: payload.options,
      };

      await jobRef.set(jobData);

      const jobId = jobRef.id;

      // Update job status to processing
      await jobRef.update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Process export asynchronously
      const databaseService = getDatabaseService();
      
      try {
        const result = await exportService.exportEntities(
          payload,
          databaseService,
          userContext.userId,
        );

        // Update job with results
        await jobRef.update({
          status: "completed",
          fileUrl: result.fileUrl,
          fileSizeBytes: result.sizeBytes,
          stats: result.stats,
          updatedAt: FieldValue.serverTimestamp(),
        });

        loggerService.info("Export job completed", {
          jobId,
          orgId: payload.orgId,
          stats: result.stats,
          notifyEmail: jobData.notifyEmail,
        });

        // Send email notification if notifyEmail is true
        const emailRecipient = jobData.emailRecipient || userContext.email;
        if (jobData.notifyEmail && emailRecipient) {
          try {
            const emailService = new ResendEmailService({
              apiKey: resendApiKey.value(),
              defaultFromEmail: resendFromEmail.value(),
              defaultFromName: resendFromName.value(),
            });

            const entityTypesLabel = payload.entityTypes.join(", ");
            const formatLabel = payload.format.toUpperCase();

            await emailService.sendEmail({
              to: { email: emailRecipient, name: userContext.name || "User" },
              from: { email: resendFromEmail.value(), name: resendFromName.value() },
              subject: `Your ${entityTypesLabel} export is ready`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">Your Export is Ready!</h2>
                  <p>Your data export has been completed successfully.</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Entity Types:</strong> ${entityTypesLabel}</p>
                    <p><strong>Format:</strong> ${formatLabel}</p>
                    <p><strong>Total Records:</strong> ${result.stats.totalRecords}</p>
                    <p><strong>File Size:</strong> ${(result.sizeBytes / 1024).toFixed(2)} KB</p>
                  </div>
                  <p>
                    <a href="${result.fileUrl}" 
                       style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                      Download Export File
                    </a>
                  </p>
                  <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This link will be valid for 7 days. If you have any questions, please contact support.
                  </p>
                </div>
              `,
              text: `
Your Export is Ready!

Your data export has been completed successfully.

Entity Types: ${entityTypesLabel}
Format: ${formatLabel}
Total Records: ${result.stats.totalRecords}
File Size: ${(result.sizeBytes / 1024).toFixed(2)} KB

Download your export file: ${result.fileUrl}

This link will be valid for 7 days.
              `,
            });

            loggerService.info("Export completion email sent", {
              jobId,
              orgId: payload.orgId,
              emailRecipient,
            });
          } catch (emailError) {
            loggerService.warn("Failed to send export completion email", {
              jobId,
              orgId: payload.orgId,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
            // Don't throw - email failure shouldn't fail the export
          }
        }

        await logAuditSuccessForRequest({
          request,
          operationName: "exportData",
          organizationId: payload.orgId,
          action: "data.exported",
          resource: {
            type: "export_job",
            id: jobId,
          },
          metadata: {
            source: "api",
            customFields: {
              entityTypes: payload.entityTypes,
              format: payload.format,
              stats: result.stats,
              fileSizeBytes: result.sizeBytes,
            },
          },
          fallbackUserContext: userContext,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        loggerService.error("Export job failed", {
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
      loggerService.error("Failed to create export job", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create export job: ${error.message}`,
      );
    }
  },
);
