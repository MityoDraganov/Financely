import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleGenerateTemplateFromExtraction } from "../app/handle-generate-template-from-extraction";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { TemplateData } from "../core/entities/template";
import {
  AI_TASKS,
  configureAIProviderForTask,
  geminiApiKeySecret,
  openAiApiKeySecret,
} from "../services/ai/provider-routing";

interface GenerateTemplateFromExtractionPayload {
  jobId: string;
  editedData?: Record<string, unknown>;
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    templateName?: string;
    strategy?: "layout_fusion_v2" | "legacy";
    qualityTarget?: "pixel";
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
    secrets: [geminiApiKeySecret, openAiApiKeySecret],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { jobId, options, editedData } = request.data;

      if (!jobId) {
        throw new HttpsError(
          "invalid-argument",
          "Job ID (jobId) is required"
        );
      }

      // Get the extraction job to verify org membership
      const databaseService = getDatabaseService();
      const extractionJobRepository = getExtractionJobRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
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

      const organization = await organizationRepository.get({ id: job.orgId });
      if (!organization) {
        throw new HttpsError("not-found", `Organization not found: ${job.orgId}`);
      }
      const aiConfig = configureAIProviderForTask({
        organization,
        task: AI_TASKS.invoiceTemplateFromExtractionGeneration,
      });

      loggerService.info("Starting template generation from extraction", {
        jobId,
        orgId: job.orgId,
        style: options?.style,
        provider: aiConfig.provider,
        model: aiConfig.model,
        providerSource: aiConfig.providerSource,
        modelSource: aiConfig.modelSource,
      });

      // Generate template
      const generated = await handleGenerateTemplateFromExtraction(jobId, options, editedData);

      // Note: Success log is already in the service layer, no need to duplicate

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
            templateName: generated.template.name,
            elementCount: generated.template.elements.length,
            needsReview: generated.needsReview,
            qualityOverall: generated.quality.overall,
          },
        });
      } catch (usageError) {
        loggerService.warn("Failed to record usage event for template generation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return { template: generated.template };
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
