import { logger } from "firebase-functions";
import { AIProvider, AIGenerationOptions, JSONSchema } from "./ai-service";

/**
 * Gemini AI Provider Implementation for Firebase Functions
 * Uses Google's Gemini API for content generation
 */
export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.5-flash";
  }

  getName(): string {
    return "gemini";
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async generate(prompt: string, options?: AIGenerationOptions): Promise<string> {
    const url = `${this.apiBaseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          topK: options?.topK ?? 40,
          topP: options?.topP ?? 0.95,
          maxOutputTokens: options?.maxTokens ?? 8192,
          ...(options?.stopSequences && { stopSequences: options.stopSequences }),
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = `Gemini API error: ${errorJson.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage = `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`;
        }
      }
      
      logger.error("Gemini API error", {
        status: response.status,
        statusText: response.statusText,
        model: this.model,
      });
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
    };

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Invalid response from Gemini API: No candidates returned");
    }

    const candidate = data.candidates[0];
    if (!candidate.content?.parts || candidate.content.parts.length === 0) {
      throw new Error("Invalid response from Gemini API: No content parts in candidate");
    }

    const textPart = candidate.content.parts.find((part) => part.text);
    if (!textPart || !textPart.text) {
      throw new Error("Invalid response from Gemini API: No text content in parts");
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      if (candidate.finishReason === "MAX_TOKENS") {
        // Response was truncated but still usable
        return textPart.text;
      }
      throw new Error(`Gemini API content blocked: ${candidate.finishReason}`);
    }

    return textPart.text;
  }

  async generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T> {
    // Use Gemini's native JSON mode for better structured output
    const url = `${this.apiBaseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    // Enhance prompt to request JSON output
    let jsonPrompt = prompt;
    
    if (schema) {
      jsonPrompt += `\n\nPlease respond with a valid JSON object matching this schema: ${JSON.stringify(schema, null, 2)}`;
    } else {
      jsonPrompt += "\n\nPlease respond with valid JSON only, no markdown, no explanations.";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: jsonPrompt }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          topK: options?.topK ?? 40,
          topP: options?.topP ?? 0.95,
          maxOutputTokens: options?.maxTokens ?? 8192,
          responseMimeType: "application/json", // Force JSON output
          ...(options?.stopSequences && { stopSequences: options.stopSequences }),
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = `Gemini API error: ${errorJson.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage = `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`;
        }
      }
      
      logger.error("Gemini API error", {
        status: response.status,
        statusText: response.statusText,
        model: this.model,
      });
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
    };

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Invalid response from Gemini API: No candidates returned");
    }

    const candidate = data.candidates[0];
    if (!candidate.content?.parts || candidate.content.parts.length === 0) {
      throw new Error("Invalid response from Gemini API: No content parts in candidate");
    }

    const textPart = candidate.content.parts.find((part) => part.text);
    if (!textPart || !textPart.text) {
      throw new Error("Invalid response from Gemini API: No text content in parts");
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      if (candidate.finishReason === "MAX_TOKENS") {
        logger.warn("Gemini response truncated due to MAX_TOKENS", {
          model: this.model,
          maxTokens: options?.maxTokens ?? 8192,
        });
        // Still try to parse what we got
      } else {
        throw new Error(`Gemini API content blocked: ${candidate.finishReason}`);
      }
    }

    const responseText = textPart.text;
    
    // Try to parse JSON from the response
    try {
      // Remove markdown code blocks if present (though responseMimeType should prevent this)
      let cleaned = responseText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\s*/i, "").replace(/```\s*$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\s*/i, "").replace(/```\s*$/, "");
      }
      
      return JSON.parse(cleaned) as T;
    } catch (error) {
      logger.error("Failed to parse JSON response from Gemini", {
        error: error instanceof Error ? error.message : "Unknown error",
        responsePreview: responseText.substring(0, 500),
        finishReason: candidate.finishReason,
      });
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

