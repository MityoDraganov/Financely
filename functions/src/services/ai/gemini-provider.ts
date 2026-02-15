import { logger } from "firebase-functions";
import { AIProvider, AIGenerationOptions, ImageInput, JSONSchema } from "./ai-service";

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

    const responseText = extractTextFromParts(candidate.content.parts);
    if (!responseText) {
      throw new Error("Invalid response from Gemini API: No text content in parts");
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      if (candidate.finishReason === "MAX_TOKENS") {
        // Response was truncated but still usable
        return responseText;
      }
      throw new Error(`Gemini API content blocked: ${candidate.finishReason}`);
    }

    return responseText;
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

    const responseText = extractTextFromParts(candidate.content.parts);
    if (!responseText) {
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

    return parseGeminiJsonResponse<T>(responseText, {
      context: "Gemini",
      finishReason: candidate.finishReason,
      model: this.model,
      maxTokens: options?.maxTokens ?? 8192,
    });
  }

  async generateJSONWithImage<T = unknown>(
    image: ImageInput,
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions
  ): Promise<T> {
    const url = `${this.apiBaseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    let jsonPrompt = prompt;
    if (schema) {
      jsonPrompt += `\n\nPlease respond with a valid JSON object matching this schema: ${JSON.stringify(schema, null, 2)}`;
    } else {
      jsonPrompt += "\n\nPlease respond with valid JSON only, no markdown, no explanations.";
    }

    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [
      { inlineData: { mimeType: image.mimeType, data: image.data } },
      { text: jsonPrompt },
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          topK: options?.topK ?? 40,
          topP: options?.topP ?? 0.95,
          maxOutputTokens: options?.maxTokens ?? 8192,
          responseMimeType: "application/json",
          ...(options?.stopSequences && { stopSequences: options.stopSequences }),
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
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
      logger.error("Gemini API error", { status: response.status, statusText: response.statusText, model: this.model });
      throw new Error(errorMessage);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
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

    const responseText = extractTextFromParts(candidate.content.parts);
    if (!responseText) {
      throw new Error("Invalid response from Gemini API: No text content in parts");
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
      throw new Error(`Gemini API content blocked: ${candidate.finishReason}`);
    }

    try {
      return parseGeminiJsonResponse<T>(responseText, {
        context: "Gemini vision",
        finishReason: candidate.finishReason,
        model: this.model,
        maxTokens: options?.maxTokens ?? 8192,
      });
    } catch (error) {
      if (candidate.finishReason !== "MAX_TOKENS") {
        throw error;
      }

      logger.warn("Gemini vision response truncated; retrying with compact JSON prompt", {
        model: this.model,
        maxTokens: options?.maxTokens ?? 8192,
      });

      const retryPrompt = `${jsonPrompt}

CRITICAL:
- Output must be STRICT JSON.
- Minify JSON (single line, no indentation).
- Keep all strings concise.
- Do not include markdown or commentary.
- If output could be long, prioritize required fields and omit optional ones.`;

      const retryResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: image.mimeType, data: image.data } },
              { text: retryPrompt },
            ],
          }],
          generationConfig: {
            temperature: 0,
            topK: options?.topK ?? 40,
            topP: options?.topP ?? 0.95,
            maxOutputTokens: Math.max(options?.maxTokens ?? 8192, 8192),
            responseMimeType: "application/json",
            ...(options?.stopSequences && { stopSequences: options.stopSequences }),
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      });

      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        throw new Error(
          `Gemini vision retry failed: ${retryResponse.status} ${retryResponse.statusText} - ${retryErrorText}`
        );
      }

      const retryData = await retryResponse.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };

      const retryCandidate = retryData.candidates?.[0];
      const retryText = retryCandidate?.content?.parts
        ? extractTextFromParts(retryCandidate.content.parts)
        : "";

      if (!retryText) {
        throw new Error("Invalid response from Gemini vision retry: No text content in parts");
      }

      return parseGeminiJsonResponse<T>(retryText, {
        context: "Gemini vision retry",
        finishReason: retryCandidate?.finishReason,
        model: this.model,
        maxTokens: Math.max(options?.maxTokens ?? 8192, 8192),
      });
    }
  }
}

function extractTextFromParts(parts: Array<{ text?: string }>): string {
  return parts
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function parseGeminiJsonResponse<T = unknown>(
  responseText: string,
  context: {
    context: string;
    finishReason?: string;
    model: string;
    maxTokens: number;
  }
): T {
  const cleaned = cleanModelJsonText(responseText);

  const direct = tryParseJSON<T>(cleaned);
  if (direct.ok) return direct.value;

  const balancedSlice = extractBalancedJsonSlice(cleaned);
  if (balancedSlice) {
    const parsedBalanced = tryParseJSON<T>(balancedSlice);
    if (parsedBalanced.ok) {
      logger.warn(`${context.context} JSON recovered from balanced slice`, {
        model: context.model,
        finishReason: context.finishReason,
      });
      return parsedBalanced.value;
    }
  }

  const repaired = repairLikelyTruncatedJson(cleaned);
  if (repaired) {
    const parsedRepaired = tryParseJSON<T>(repaired);
    if (parsedRepaired.ok) {
      logger.warn(`${context.context} JSON recovered from truncated response`, {
        model: context.model,
        finishReason: context.finishReason,
      });
      return parsedRepaired.value;
    }
  }

  logger.error(`Failed to parse JSON response from ${context.context}`, {
    error: direct.error,
    responsePreview: responseText.substring(0, 500),
    finishReason: context.finishReason,
    model: context.model,
    maxTokens: context.maxTokens,
  });

  throw new Error(`Failed to parse JSON response: ${direct.error}`);
}

function cleanModelJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/```json\s*/i, "").replace(/```\s*$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```\s*/i, "").replace(/```\s*$/, "");
  }
  return cleaned.trim();
}

function tryParseJSON<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown JSON parse error",
    };
  }
}

function extractBalancedJsonSlice(text: string): string | null {
  const start = findJsonStartIndex(text);
  if (start < 0) return null;

  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let lastBalancedEnd = -1;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const last = stack[stack.length - 1];
      if ((char === "}" && last === "{") || (char === "]" && last === "[")) {
        stack.pop();
        if (stack.length === 0) {
          lastBalancedEnd = index;
          break;
        }
      }
    }
  }

  if (lastBalancedEnd < 0) {
    return null;
  }

  return text.slice(start, lastBalancedEnd + 1);
}

function repairLikelyTruncatedJson(text: string): string | null {
  const start = findJsonStartIndex(text);
  if (start < 0) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastTopLevelComma = -1;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const last = stack[stack.length - 1];
      if ((char === "}" && last === "{") || (char === "]" && last === "[")) {
        stack.pop();
      }
      continue;
    }

    if (char === "," && stack.length === 1) {
      lastTopLevelComma = index;
    }
  }

  let candidate = text.slice(start);
  if (lastTopLevelComma > start) {
    candidate = text.slice(start, lastTopLevelComma);
  }

  if (inString) {
    const lastQuote = candidate.lastIndexOf("\"");
    if (lastQuote >= 0) {
      candidate = candidate.slice(0, lastQuote);
    }
  }

  candidate = candidate.trim().replace(/[,:]\s*$/, "");

  const openersToClose = collectUnclosedDelimiters(candidate);
  for (let index = openersToClose.length - 1; index >= 0; index -= 1) {
    const opener = openersToClose[index];
    candidate += opener === "{" ? "}" : "]";
  }

  return candidate;
}

function findJsonStartIndex(text: string): number {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  if (objectStart < 0) return arrayStart;
  if (arrayStart < 0) return objectStart;
  return Math.min(objectStart, arrayStart);
}

function collectUnclosedDelimiters(text: string): string[] {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const last = stack[stack.length - 1];
      if ((char === "}" && last === "{") || (char === "]" && last === "[")) {
        stack.pop();
      }
    }
  }

  return stack;
}
