import { defineSecret } from "firebase-functions/params";

const { genkit } = require("genkit") as { genkit: (config: unknown) => unknown };
const { googleAI } = require("@genkit-ai/google-genai") as {
  googleAI: (config: unknown) => unknown;
};

export const genkitGeminiApiKeySecret = defineSecret("GEMINI_API_KEY");

export type OfficialTemplateGenkit = {
  generate: (input: {
    model: unknown;
    prompt: string;
    output: { schema: unknown };
  }) => Promise<{ output: unknown }>;
  defineFlow: <TInput, TOutput>(
    options: {
      name: string;
      inputSchema: unknown;
      outputSchema: unknown;
    },
    handler: (input: TInput) => Promise<TOutput> | TOutput,
  ) => (input: TInput) => Promise<TOutput>;
};

let cachedRuntime: OfficialTemplateGenkit | null = null;
let cachedApiKey: string | null = null;

export function getOfficialTemplateGenkit(apiKey: string): OfficialTemplateGenkit {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    throw new Error("GEMINI_API_KEY secret is not configured");
  }

  if (cachedRuntime && cachedApiKey === normalizedApiKey) {
    return cachedRuntime;
  }

  cachedRuntime = genkit({
    plugins: [googleAI({ apiKey: normalizedApiKey })],
  }) as OfficialTemplateGenkit;
  cachedApiKey = normalizedApiKey;
  return cachedRuntime;
}
