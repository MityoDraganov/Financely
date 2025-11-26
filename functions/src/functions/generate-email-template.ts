import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getEmailTemplateGenerationService } from "../services/ai/email-template-generation-service";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

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
    secrets: [geminiApiKey],
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
          model: "gemini-2.0-flash-exp",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

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

