import { logger } from "firebase-functions";
import { AIProvider, AIGenerationOptions, ImageInput, JSONSchema } from "./ai-service";

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    finish_reason?: string;
  }>;
};

/**
 * OpenAI provider implementation for Cloud Functions.
 */
export class OpenAIProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiBaseUrl = "https://api.openai.com/v1";

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gpt-4.1-mini";
  }

  getName(): string {
    return "openai";
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async generate(prompt: string, options?: AIGenerationOptions): Promise<string> {
    const data = await this.requestChatCompletions({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      ...samplingParams(this.model, options),
      ...maxTokensParam(this.model, options?.maxTokens ?? 8192),
      ...(options?.stopSequences && { stop: options.stopSequences }),
    });

    const text = extractTextFromMessage(data.choices?.[0]?.message?.content);
    if (!text) {
      throw new Error("Invalid response from OpenAI API: No content returned");
    }

    return text;
  }

  async generateJSON<T = unknown>(
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions,
  ): Promise<T> {
    let jsonPrompt = prompt;
    if (schema) {
      jsonPrompt += `\n\nRespond with a valid JSON object matching this schema: ${JSON.stringify(schema, null, 2)}`;
    } else {
      jsonPrompt += "\n\nRespond with valid JSON only. Do not include markdown or explanations.";
    }

    const data = await this.requestChatCompletions({
      model: this.model,
      messages: [{ role: "user", content: jsonPrompt }],
      ...samplingParams(this.model, options),
      ...maxTokensParam(this.model, options?.maxTokens ?? 8192),
      response_format: { type: "json_object" },
      ...(options?.stopSequences && { stop: options.stopSequences }),
    });

    const responseText = extractTextFromMessage(data.choices?.[0]?.message?.content);
    if (!responseText) {
      throw new Error("Invalid response from OpenAI API: No JSON content returned");
    }

    return parseOpenAiJsonResponse<T>(responseText, {
      context: "OpenAI",
      finishReason: data.choices?.[0]?.finish_reason,
      model: this.model,
    });
  }

  async generateJSONWithImage<T = unknown>(
    image: ImageInput,
    prompt: string,
    schema?: JSONSchema,
    options?: AIGenerationOptions,
  ): Promise<T> {
    let jsonPrompt = prompt;
    if (schema) {
      jsonPrompt += `\n\nRespond with a valid JSON object matching this schema: ${JSON.stringify(schema, null, 2)}`;
    } else {
      jsonPrompt += "\n\nRespond with valid JSON only. Do not include markdown or explanations.";
    }

    const imageDataUrl = `data:${image.mimeType};base64,${image.data}`;

    const data = await this.requestChatCompletions({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: jsonPrompt },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      ...samplingParams(this.model, options),
      ...maxTokensParam(this.model, options?.maxTokens ?? 8192),
      response_format: { type: "json_object" },
      ...(options?.stopSequences && { stop: options.stopSequences }),
    });

    const responseText = extractTextFromMessage(data.choices?.[0]?.message?.content);
    if (!responseText) {
      throw new Error("Invalid response from OpenAI API vision call: No JSON content returned");
    }

    return parseOpenAiJsonResponse<T>(responseText, {
      context: "OpenAI vision",
      finishReason: data.choices?.[0]?.finish_reason,
      model: this.model,
    });
  }

  private async requestChatCompletions(body: Record<string, unknown>): Promise<OpenAIChatCompletionResponse> {
    const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = `OpenAI API error: ${errorJson.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage = `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`;
        }
      }

      logger.error("OpenAI API error", {
        status: response.status,
        statusText: response.statusText,
        model: this.model,
      });

      throw new Error(errorMessage);
    }

    return await response.json() as OpenAIChatCompletionResponse;
  }
}

/**
 * Newer OpenAI models (o-series, gpt-5.x) require `max_completion_tokens` instead of `max_tokens`.
 * Returns the appropriate parameter key for the given model.
 */
function maxTokensParam(model: string, value: number): Record<string, number> {
  return usesNextGenModelParams(model) ? { max_completion_tokens: value } : { max_tokens: value };
}

/**
 * Some newer models only support default sampling values; omit custom sampling params there.
 */
function samplingParams(
  model: string,
  options?: AIGenerationOptions,
): Record<string, number> {
  if (usesNextGenModelParams(model)) {
    if (typeof options?.temperature === "number" && options.temperature !== 1) {
      logger.warn("Ignoring unsupported temperature for model; using model default", {
        model,
        requestedTemperature: options.temperature,
      });
    }
    if (typeof options?.topP === "number" && options.topP !== 1) {
      logger.warn("Ignoring unsupported top_p for model; using model default", {
        model,
        requestedTopP: options.topP,
      });
    }
    return {};
  }

  return {
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
  };
}

function usesNextGenModelParams(model: string): boolean {
  return /^o\d|^gpt-5/i.test(model);
}

function extractTextFromMessage(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content.trim();

  return content
    .map((item) => (item.type === "text" && item.text ? item.text : ""))
    .join("")
    .trim();
}

function parseOpenAiJsonResponse<T = unknown>(
  responseText: string,
  context: { context: string; finishReason?: string; model: string },
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

function findJsonStartIndex(text: string): number {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");

  if (objectStart < 0) return arrayStart;
  if (arrayStart < 0) return objectStart;

  return Math.min(objectStart, arrayStart);
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
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      const top = stack[stack.length - 1];
      if (!top || top !== expected) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        lastBalancedEnd = index;
      }
    }
  }

  if (lastBalancedEnd >= 0) {
    return text.slice(start, lastBalancedEnd + 1);
  }

  return null;
}

function repairLikelyTruncatedJson(text: string): string | null {
  const start = findJsonStartIndex(text);
  if (start < 0) return null;

  let result = text.slice(start).trim();
  if (!result) return null;

  // Remove trailing commas before closing braces/brackets.
  result = result.replace(/,\s*([}\]])/g, "$1");

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let index = 0; index < result.length; index += 1) {
    const char = result[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] === expected) {
        stack.pop();
      }
    }
  }

  if (inString) {
    result += '"';
  }

  while (stack.length > 0) {
    const opener = stack.pop();
    if (opener === "{") {
      result += "}";
    } else if (opener === "[") {
      result += "]";
    }
  }

  result = result.replace(/,\s*([}\]])/g, "$1");

  return result;
}
