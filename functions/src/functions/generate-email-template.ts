import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getEmailTemplateGenerationService } from "../services/ai/email-template-generation-service";
import {
  AI_TASKS,
  configureAIProviderForTask,
  geminiApiKeySecret,
  openAiApiKeySecret,
} from "../services/ai/provider-routing";

interface GenerateEmailTemplatePayload {
  organizationId: string;
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
    customPrompt?: string;
    images?: Array<{
      url: string;
      purpose: "reference" | "use-in-template";
      description?: string;
    }>;
    context?: {
      products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
      organizationName?: string;
      organizationSettings?: Record<string, unknown>;
      galleryImages?: string[];
    };
    allowedContexts?: string[];
    dynamicSources?: Array<{
      placeholderKey: string;
      entity: "product" | "contact" | "invoice" | "proposal";
      path: string;
      label?: string;
      description?: string;
      valueType?: "string" | "number" | "boolean" | "date" | "array" | "object" | "unknown";
      required?: boolean;
      sourceKind?: "field" | "metafield";
    }>;
    generateCustomHtml?: boolean;
    targetSection?: "header" | "body" | "footer" | "full";
  };
}

/**
 * Firebase Cloud Function for generating email templates using AI.
 * 
 * This function uses AI to generate a beautiful, functional email template
 * based on the organization's context, user instructions, and provided images.
 * 
 * Request payload:
 * {
 *   organizationId: string,
 *   options?: {
 *     style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional",
 *     customPrompt?: string,
 *     images?: Array<{ url: string; purpose: "reference" | "use-in-template"; description?: string }>,
 *     context?: {
 *       products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>,
 *       organizationName?: string,
 *       organizationSettings?: Record<string, unknown>,
 *       galleryImages?: string[]
 *     },
 *     allowedContexts?: string[],
 *     dynamicSources?: Array<{ placeholderKey, entity, path, label?, description?, valueType?, required?, sourceKind? }>,
 *     generateCustomHtml?: boolean,
 *     targetSection?: "header" | "body" | "footer" | "full"
 *   }
 * }
 * 
 * Response: EmailTemplateData object with htmlContent, blocks, designTokens, etc.
 */
export const generateEmailTemplate = onCall<GenerateEmailTemplatePayload>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKeySecret, openAiApiKeySecret],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, options } = request.data;

      if (!organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "organizationId is required",
        );
      }

      logger.info("Generating email template", {
        organizationId,
        style: options?.style,
        hasCustomPrompt: !!options?.customPrompt,
        imageCount: options?.images?.length || 0,
        targetSection: options?.targetSection || "full",
        generateCustomHtml: options?.generateCustomHtml || false,
        allowedContextCount: options?.allowedContexts?.length || 0,
        dynamicSourceCount: options?.dynamicSources?.length || 0,
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

      const aiConfig = configureAIProviderForTask({
        organization,
        task: AI_TASKS.emailTemplateGeneration,
      });
      logger.info("Email template AI config resolved", {
        organizationId,
        provider: aiConfig.provider,
        model: aiConfig.model,
        providerSource: aiConfig.providerSource,
        modelSource: aiConfig.modelSource,
      });

      // Generate email template
      const templateGenerationService = getEmailTemplateGenerationService();
      const template = await templateGenerationService.generateEmailTemplate(
        organization,
        options
      );

      logger.info("Email template generated successfully", {
        organizationId,
        templateName: template.name,
        subject: template.subject,
        blockCount: template.blocks.length,
        htmlLength: template.htmlContent.length,
      });

      // Record usage event
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        const { extractUserContextFromRequest } = await import("../utils/request-context");
        
        const userContext = await extractUserContextFromRequest(request);
        
        await recordUsageEvent({
          orgId: organizationId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.AI_EMAIL_TEMPLATE_GENERATE,
          metadata: {
            context: "api",
            payloadType: "email_template",
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage event for email template generation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return template;
    } catch (error) {
      logger.error("Error generating email template", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to generate email template",
      );
    }
  },
);
