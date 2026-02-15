import { templateDataSchema } from "../../core/entities/template";
import type { TemplateData } from "../../core/entities/template";
import type { AIService } from "./ai-service";
import type { JSONSchema } from "./ai-service";

/**
 * Validates template data against the canonical schema.
 */
export function validateTemplateData(template: TemplateData) {
  return templateDataSchema.safeParse(template);
}

/**
 * One-shot repair: send invalid raw result and validation errors to the model,
 * get back a repaired raw result. Caller must re-build and re-validate.
 */
export async function repairTemplateGenerationRaw(
  aiService: AIService,
  rawResult: unknown,
  errorMessage: string,
  schema: JSONSchema
): Promise<unknown> {
  const prompt = `The following JSON is a template generation result that failed validation. Fix it so it conforms to the schema. Output only valid JSON, no markdown or explanation.

Validation errors:
${errorMessage}

Current JSON:
${JSON.stringify(rawResult, null, 2)}`;
  return aiService.generateJSON<unknown>(prompt, schema, {
    temperature: 0.2,
    maxTokens: 16384,
  });
}
