/**
 * Firebase Cloud Function for translating widget text using AI
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import type { JSONSchema } from "../services/ai/ai-service";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface TranslateWidgetTextInput {
  organizationId: string;
  languageCode: string;
  languageName: string;
  translations: Array<{
    key: string;
    english: string;
  }>;
}

export interface TranslateWidgetTextOutput {
  translations: Record<string, string>;
  translatedCount: number;
}

export const translateWidgetText = onCall<
  TranslateWidgetTextInput,
  Promise<TranslateWidgetTextOutput>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, languageCode, languageName, translations } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      if (!languageCode) {
        throw new HttpsError("invalid-argument", "Language code is required");
      }

      if (!languageName) {
        throw new HttpsError("invalid-argument", "Language name is required");
      }

      if (!translations || !Array.isArray(translations) || translations.length === 0) {
        throw new HttpsError("invalid-argument", "Translations array is required and must not be empty");
      }

      loggerService.info("Translating widget text", {
        organizationId,
        languageCode,
        languageName,
        translationCount: translations.length,
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

      // Build translation prompt with clearer structure
      const translationsList = translations
        .map((t) => `"${t.key}": "${t.english}"`)
        .join(",\n  ");

      const expectedKeys = translations.map((t) => `"${t.key}"`).join(", ");

      const prompt = `You are a professional translator. Translate the following English text to ${languageName}.

Translate each English phrase below to ${languageName}. Return a JSON object with the exact same keys, but with translated values.

English text to translate:
{
  ${translationsList}
}

Return a JSON object with these exact keys: ${expectedKeys}

Example format:
{
  "requestInvoice": "translated phrase in ${languageName}",
  "submitButton": "translated phrase in ${languageName}",
  "successMessage": "translated phrase in ${languageName}",
  "name": "translated phrase in ${languageName}",
  "email": "translated phrase in ${languageName}",
  "message": "translated phrase in ${languageName}"
}

Return ONLY the JSON object, no markdown, no explanations.`;

      // Build JSON schema to guide the AI
      const schema: Record<string, JSONSchema> = {};
      translations.forEach(({ key, english }) => {
        schema[key] = {
          type: "string",
          description: `Translation of "${english}" to ${languageName}`,
        };
      });

      const jsonSchema: JSONSchema = {
        type: "object",
        properties: schema,
        required: translations.map((t) => t.key),
      };

      loggerService.info("Sending translation request to AI", {
        languageCode,
        languageName,
        keys: translations.map((t) => t.key),
        schemaKeys: Object.keys(jsonSchema.properties || {}),
      });

      const response = await aiService.generateJSON<Record<string, string>>(prompt, jsonSchema, {
        temperature: 0.3,
      });

      loggerService.info("Received AI translation response", {
        languageCode,
        responseKeys: Object.keys(response || {}),
        responseSample: JSON.stringify(response).substring(0, 200),
      });

      // Validate and count translations
      const translated: Record<string, string> = {};
      let translatedCount = 0;

      translations.forEach(({ key, english }) => {
        if (response && response[key] && typeof response[key] === "string" && response[key].trim() !== "") {
          translated[key] = response[key].trim();
          translatedCount++;
        } else {
          // If translation is missing or empty, log a warning but don't fail
          loggerService.warn("Translation missing or empty", {
            key,
            english,
            languageCode,
            responseValue: response?.[key],
            allResponseKeys: Object.keys(response || {}),
          });
        }
      });

      loggerService.info("Widget text translated successfully", {
        organizationId,
        languageCode,
        translatedCount,
        totalCount: translations.length,
      });

      return {
        translations: translated,
        translatedCount,
      };
    } catch (error) {
      loggerService.error("Failed to translate widget text", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
        languageCode: request.data?.languageCode,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to translate widget text: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

