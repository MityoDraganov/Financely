import { AIProvider, AIGenerationOptions, JSONSchema } from "@/core/ports/services/ai-service";

/**
 * Gemini AI Provider Implementation
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
    // Enhance prompt to request JSON output
    let jsonPrompt = prompt;
    
    if (schema) {
      jsonPrompt += `\n\nPlease respond with a valid JSON object matching this schema: ${JSON.stringify(schema, null, 2)}`;
    } else {
      jsonPrompt += "\n\nPlease respond with valid JSON only, no markdown, no explanations.";
    }

    const response = await this.generate(jsonPrompt, options);
    
    // Try to parse JSON from the response
    try {
      // Remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\s*/i, "").replace(/```\s*$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\s*/i, "").replace(/```\s*$/, "");
      }
      
      return JSON.parse(cleaned) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

