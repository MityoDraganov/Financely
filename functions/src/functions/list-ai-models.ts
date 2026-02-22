import { HttpsError, onCall } from "firebase-functions/v2/https";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { geminiApiKeySecret, openAiApiKeySecret } from "../services/ai/provider-routing";

type ProviderName = "gemini" | "openai";

interface ListAiModelsPayload {
  organizationId: string;
  providers?: ProviderName[];
}

interface ModelItem {
  provider: ProviderName;
  id: string;
  displayName: string;
}

interface ProviderStatus {
  available: boolean;
  count: number;
  error?: string;
}

interface ListAiModelsResponse {
  models: ModelItem[];
  providers: {
    gemini: ProviderStatus;
    openai: ProviderStatus;
  };
  fetchedAt: string;
}

export const listAiModels = onCall<ListAiModelsPayload, Promise<ListAiModelsResponse>>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKeySecret, openAiApiKeySecret],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    const payload = request.data;
    const organizationId = payload?.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new HttpsError("invalid-argument", "organizationId is required");
    }

    await verifyAuthAndOrgMembership(request, organizationId, {
      requiredRole: ORGANIZATION_ROLES.MEMBER,
    });

    const providers = normalizeProviders(payload?.providers);

    const response: ListAiModelsResponse = {
      models: [],
      providers: {
        gemini: { available: false, count: 0 },
        openai: { available: false, count: 0 },
      },
      fetchedAt: new Date().toISOString(),
    };

    if (providers.includes("gemini")) {
      const apiKey = geminiApiKeySecret.value();
      if (!apiKey) {
        response.providers.gemini = {
          available: false,
          count: 0,
          error: "GEMINI_API_KEY not configured",
        };
      } else {
        try {
          const models = await fetchGeminiModels(apiKey);
          response.models.push(...models);
          response.providers.gemini = {
            available: true,
            count: models.length,
          };
        } catch (error) {
          response.providers.gemini = {
            available: false,
            count: 0,
            error: error instanceof Error ? error.message : "Failed to fetch Gemini models",
          };
        }
      }
    }

    if (providers.includes("openai")) {
      const apiKey = openAiApiKeySecret.value();
      if (!apiKey) {
        response.providers.openai = {
          available: false,
          count: 0,
          error: "OPENAI_API_KEY not configured",
        };
      } else {
        try {
          const models = await fetchOpenAiModels(apiKey);
          response.models.push(...models);
          response.providers.openai = {
            available: true,
            count: models.length,
          };
        } catch (error) {
          response.providers.openai = {
            available: false,
            count: 0,
            error: error instanceof Error ? error.message : "Failed to fetch OpenAI models",
          };
        }
      }
    }

    response.models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.displayName.localeCompare(b.displayName);
    });

    loggerService.info("Listed AI models", {
      organizationId,
      totalModels: response.models.length,
      geminiCount: response.providers.gemini.count,
      openAiCount: response.providers.openai.count,
    });

    return response;
  },
);

function normalizeProviders(rawProviders: unknown): ProviderName[] {
  if (!Array.isArray(rawProviders) || rawProviders.length === 0) {
    return ["gemini", "openai"];
  }

  const parsed = rawProviders.filter(
    (provider): provider is ProviderName => provider === "gemini" || provider === "openai",
  );

  return parsed.length > 0 ? Array.from(new Set(parsed)) : ["gemini", "openai"];
}

async function fetchGeminiModels(apiKey: string): Promise<ModelItem[]> {
  const models: ModelItem[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  let safetyCounter = 0;

  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini models API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as {
      models?: Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
      nextPageToken?: string;
    };

    for (const model of data.models || []) {
      const rawName = model.name || "";
      const id = rawName.replace(/^models\//, "").trim();
      if (!id || seen.has(id)) {
        continue;
      }

      const supportsGeneration = (model.supportedGenerationMethods || []).includes("generateContent");
      if (!supportsGeneration) {
        continue;
      }

      seen.add(id);
      models.push({
        provider: "gemini",
        id,
        displayName: model.displayName?.trim() || id,
      });
    }

    pageToken = data.nextPageToken;
    safetyCounter += 1;
  } while (pageToken && safetyCounter < 20);

  return models;
}

async function fetchOpenAiModels(apiKey: string): Promise<ModelItem[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI models API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as {
    data?: Array<{ id?: string }>;
  };

  const seen = new Set<string>();
  const models: ModelItem[] = [];

  for (const model of data.data || []) {
    const id = (model.id || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    models.push({
      provider: "openai",
      id,
      displayName: id,
    });
  }

  return models;
}
