import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { handleExtractInvoiceData } from "../app/handle-extract-invoice-data";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface ExtractInvoiceDataPayload {
  jobId: string;
}

/**
 * Firebase Cloud Function for extracting invoice data from an uploaded file.
 *
 * This function:
 * 1. Retrieves the extraction job
 * 2. Calls Google Cloud Vision API for OCR
 * 3. Uses AI (Gemini) to structure the extracted data
 * 4. Updates the extraction job with results
 *
 * Request payload:
 * {
 *   jobId: string
 * }
 *
 * Response: { job: ExtractionJob }
 */
export const extractInvoiceData = onCall<ExtractInvoiceDataPayload, Promise<{ job: unknown }>>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes for OCR + AI processing
    memory: "1GiB",
  },
  async (request) => {
    try {
      const { jobId } = request.data;

      if (!jobId) {
        throw new HttpsError(
          "invalid-argument",
          "Job ID (jobId) is required"
        );
      }

      // Get the extraction job to verify org membership
      const databaseService = getDatabaseService();
      const extractionJobRepository = getExtractionJobRepository(databaseService);
      const job = await extractionJobRepository.get({ id: jobId });

      if (!job) {
        throw new HttpsError(
          "not-found",
          `Extraction job not found: ${jobId}`
        );
      }

      // Verify authentication and organization membership
      await verifyAuthAndOrgMembership(request, job.orgId, {
        requiredRole: ORGANIZATION_ROLES.MEMBER,
      });

      loggerService.info("Extracting invoice data", {
        jobId,
        orgId: job.orgId,
      });

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured"
        );
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.0-flash-exp",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Call application handler
      const updatedJob = await handleExtractInvoiceData(jobId);

      loggerService.info("Invoice data extraction completed", {
        jobId,
        status: updatedJob.status,
        extractedFieldCount: updatedJob.extractedData
          ? Object.keys(updatedJob.extractedData).length
          : 0,
      });

      // Record usage event
      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: job.orgId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.INVOICE_EXTRACTION_PROCESS,
          metadata: {
            entityId: jobId,
            context: "api",
            processingDurationMs: updatedJob.processingDurationMs,
            extractedFieldCount: updatedJob.extractedData
              ? Object.keys(updatedJob.extractedData).length
              : 0,
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        loggerService.warn("Failed to record usage event for invoice extraction", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return { job: updatedJob };
    } catch (error: any) {
      loggerService.error("Failed to extract invoice data", {
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
        `Failed to extract invoice data: ${error.message}`
      );
    }
  }
);

