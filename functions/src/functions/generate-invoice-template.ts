import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getInvoiceTemplateGenerationService } from "../services/ai/invoice-template-generation-service";
import { invoiceComplianceService } from "../services/invoice-compliance-service";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface GenerateInvoiceTemplatePayload {
  organizationId: string;
  region?: "US" | "EU" | "CA" | "AU" | "UK";
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    includeLogo?: boolean;
    customPrompt?: string;
  };
}

/**
 * Firebase Cloud Function for generating invoice templates using AI.
 * 
 * This function uses AI to generate a beautiful, functional, and fully compliant
 * invoice template based on the organization's context and compliance region.
 * 
 * Request payload:
 * {
 *   organizationId: string,
 *   region?: "US" | "EU" | "CA" | "AU" | "UK",
 *   options?: {
 *     style?: "modern" | "classic" | "minimal" | "professional",
 *     includeLogo?: boolean
 *   }
 * }
 * 
 * Response: TemplateData object
 */
export const generateInvoiceTemplate = onCall<GenerateInvoiceTemplatePayload>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, region, options } = request.data;

      if (!organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "organizationId is required",
        );
      }

      logger.info("Generating invoice template", {
        organizationId,
        region,
        options,
      });

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      // Get the organization
      const organization = await organizationRepository.get({
        id: organizationId,
      });
      if (!organization) {
        throw new HttpsError(
          "not-found",
          "Organization not found",
        );
      }

      // Detect region if not provided
      const complianceRegion = region || invoiceComplianceService.detectRegion(organization);

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured",
        );
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.5-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Generate invoice template
      const templateGenerationService = getInvoiceTemplateGenerationService();
      const template = await templateGenerationService.generateInvoiceTemplate(
        organization,
        complianceRegion,
        options
      );

      // Record usage event
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        const { extractUserContextFromRequest } = await import("../utils/request-context");
        
        const userContext = await extractUserContextFromRequest(request);
        
        await recordUsageEvent({
          orgId: organizationId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.AI_INVOICE_TEMPLATE_GENERATE,
          metadata: {
            context: "api",
            payloadType: "invoice_template",
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage event for invoice template generation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      logger.info("Invoice template generated successfully", {
        organizationId,
        region: complianceRegion,
        templateName: template.name,
        elementCount: template.elements.length,
      });

      return template;
    } catch (error) {
      logger.error("Error generating invoice template", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to generate invoice template",
      );
    }
  },
);

