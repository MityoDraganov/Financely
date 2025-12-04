import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { handleGenerateTemplateFromExtraction } from "../app/handle-generate-template-from-extraction";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { TemplateData } from "../core/entities/template";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface GenerateTemplateFromExtractionPayload {
  jobId: string;
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    templateName?: string;
  };
}

/**
 * Firebase Cloud Function for generating an invoice template from extracted invoice data.
 *
 * This function:
 * 1. Retrieves the extraction job
 * 2. Analyzes the extracted data structure
 * 3. Generates a template with matching bindings
 * 4. Returns the template data
 *
 * Request payload:
 * {
 *   jobId: string,
 *   options?: {
 *     style?: "modern" | "classic" | "minimal" | "professional",
 *     templateName?: string
 *   }
 * }
 *
 * Response: TemplateData object
 */
export const generateTemplateFromExtraction = onCall<
  GenerateTemplateFromExtractionPayload,
  Promise<{ template: TemplateData }>
>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { jobId, options } = request.data;

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

      loggerService.info("Generating template from extraction", {
        jobId,
        orgId: job.orgId,
        style: options?.style,
      });

      // Generate template
      const template = await handleGenerateTemplateFromExtraction(jobId, options);

      loggerService.info("Template generated from extraction successfully", {
        jobId,
        templateName: template.name,
        elementCount: template.elements.length,
      });

      try {
        const userContext = await extractUserContextFromRequest(request);
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: job.orgId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.AI_INVOICE_TEMPLATE_GENERATE,
          metadata: {
            entityId: jobId,
            context: "api",
            templateName: template.name,
            elementCount: template.elements.length,
          },
        });
      } catch (usageError) {
        loggerService.warn("Failed to record usage event for template generation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return { template };
    } catch (error: any) {
      loggerService.error("Failed to generate template from extraction", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to generate template from extraction: ${error.message}`
      );
    }
  }
);

