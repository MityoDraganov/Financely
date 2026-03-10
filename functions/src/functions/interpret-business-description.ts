import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getOnboardingInterpretationService } from "../services/ai/onboarding-interpretation-service";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface InterpretBusinessDescriptionPayload {
  description: string;
}

/**
 * Firebase Cloud Function for interpreting a business description during onboarding.
 *
 * This function uses Gemini Flash to extract structured business context from a
 * free-text description. No organization required — used pre-signup.
 *
 * Request payload: { description: string }
 * Response: BusinessInterpretationResult
 */
export const interpretBusinessDescription = onCall<InterpretBusinessDescriptionPayload>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    try {
      const { description } = request.data;

      if (!description || description.trim().length < 10) {
        throw new HttpsError(
          "invalid-argument",
          "Description must be at least 10 characters",
        );
      }

      logger.info("Interpreting business description for onboarding", {
        descriptionLength: description.length,
      });

      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured",
        );
      }

      const aiService = getAIService();
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.0-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      const interpretationService = getOnboardingInterpretationService();
      const result = await interpretationService.interpretBusinessDescription(description.trim());

      logger.info("Business description interpreted successfully", {
        businessType: result.businessType,
        industry: result.industry,
      });

      return result;
    } catch (error) {
      logger.error("Error interpreting business description", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to interpret business description",
      );
    }
  },
);
