/**
 * Firebase Cloud Function for generating consent banner styling using AI
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getConsentBannerGenerationService } from "../services/ai/consent-banner-generation-service";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ConsentBannerStyling } from "../core/entities/analytics-config";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface GenerateConsentBannerInput {
  organizationId: string;
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
    context?: string;
    existingStyling?: Partial<ConsentBannerStyling>;
  };
}

export interface GenerateConsentBannerOutput {
  styling: ConsentBannerStyling;
}

export const generateConsentBanner = onCall<
  GenerateConsentBannerInput,
  Promise<GenerateConsentBannerOutput>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, options } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      loggerService.info("Generating consent banner", {
        organizationId,
        style: options?.style,
      });

      // Get repositories
      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      // Fetch organization
      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

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
          model: "gemini-2.0-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Get consent banner generation service
      const consentBannerGenerationService = getConsentBannerGenerationService();

      // Generate consent banner
      const result = await consentBannerGenerationService.generateConsentBanner(
        organization,
        options
      );

      loggerService.info("Consent banner generated successfully", {
        organizationId,
      });

      return result;
    } catch (error) {
      loggerService.error("Failed to generate consent banner", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to generate consent banner: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

