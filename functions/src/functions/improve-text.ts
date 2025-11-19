import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { GeminiService } from "../services/gemini-service";

interface ImproveTextPayload {
  text: string;
  title?: string;
  language?: string;
}

/**
 * Firebase Cloud Function to improve/refine existing text using AI.
 * 
 * This function takes existing text and improves it by:
 * - Fixing grammar and spelling errors
 * - Improving clarity and readability
 * - Enhancing style and tone
 * - Maintaining the original meaning and intent
 * 
 * Request payload:
 * {
 *   text: string,        // The text to improve
 *   title?: string,      // Optional context (e.g., article title)
 *   language?: string    // Language code (default: "en")
 * }
 * 
 * Response: {
 *   improvedText: string  // The improved text in HTML format
 * }
 */
export const improveText = onCall<ImproveTextPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const { text, title, language = "en" } = request.data;

      if (!text || text.trim().length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Text is required",
        );
      }

      if (text.trim().length < 20) {
        throw new HttpsError(
          "invalid-argument",
          "Text must be at least 20 characters long",
        );
      }

      logger.info("Improving text with AI", {
        textLength: text.length,
        hasTitle: !!title,
        language,
      });

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new HttpsError(
          "internal",
          "Gemini API key not configured",
        );
      }

      const geminiService = new GeminiService({ apiKey: geminiApiKey });

      // Build prompt for text improvement
      const languageName = language === "en" ? "English" : 
        language === "es" ? "Spanish" :
        language === "fr" ? "French" :
        language === "de" ? "German" :
        language === "it" ? "Italian" :
        language === "pt" ? "Portuguese" :
        language === "nl" ? "Dutch" :
        language === "pl" ? "Polish" :
        language === "ru" ? "Russian" :
        language === "ja" ? "Japanese" :
        language === "zh" ? "Chinese" :
        language === "ko" ? "Korean" : "English";

      const prompt = `You are a professional text editor. Your task is to improve the following text by:
1. Fixing any grammar, spelling, and punctuation errors
2. Improving clarity and readability
3. Enhancing the writing style while maintaining the original tone
4. Making the text more engaging and professional
5. Preserving the original meaning and intent completely
${title ? `\n\nContext: This text is for an article titled "${title}"` : ""}

IMPORTANT REQUIREMENTS:
- Return ONLY the improved text in rich HTML format
- Preserve any existing HTML formatting (bold, italic, colors, lists, etc.)
- Do NOT add new content that wasn't in the original
- Do NOT change the meaning or main points
- Keep the same length approximately (can be slightly longer or shorter)
- Use proper HTML tags for formatting (e.g., <p>, <strong>, <em>, <ul>, <ol>, <span style="color: ...">)
- Write in ${languageName}

Original text:
${text}

Improved text (HTML only, no explanations):`;

      const improvedText = await geminiService.generateText(prompt);

      if (!improvedText || improvedText.trim().length === 0) {
        throw new HttpsError(
          "internal",
          "Failed to generate improved text",
        );
      }

      logger.info("Text improved successfully", {
        originalLength: text.length,
        improvedLength: improvedText.length,
      });

      return { improvedText: improvedText.trim() };
    } catch (error) {
      logger.error("Failed to improve text", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to improve text",
      );
    }
  }
);

