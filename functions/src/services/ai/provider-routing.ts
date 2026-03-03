import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Organization } from "../../core/entities/organization";
import { getAIService } from "./ai-service";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";

export const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");
export const openAiApiKeySecret = defineSecret("OPENAI_API_KEY");

type AIProviderName = "gemini" | "openai";
type AIProviderPreference = AIProviderName | "auto";

export const AI_TASKS = {
  invoiceTemplateGeneration: "invoice_template_generation",
  emailTemplateGeneration: "email_template_generation",
  proposalSuggestionGeneration: "proposal_suggestion_generation",
  proposalToInvoiceGeneration: "proposal_to_invoice_generation",
  invoiceDataExtraction: "invoice_data_extraction",
  invoiceTemplateFromExtractionGeneration: "invoice_template_from_extraction_generation",
  widgetGeneration: "widget_generation",
  consentBannerGeneration: "consent_banner_generation",
  translation: "translation",
  productToInvoiceFieldMapping: "product_to_invoice_field_mapping",
  leadAutoProposalGeneration: "lead_auto_proposal_generation",
  marketplaceMetadataEnrichment: "marketplace_metadata_enrichment",
} as const;

export type AITaskName = (typeof AI_TASKS)[keyof typeof AI_TASKS] | (string & {});

interface AITaskRoutingRule {
  provider?: AIProviderPreference;
  model?: string;
}

interface AIProviderConfig {
  enabled?: boolean;
  model?: string;
}

interface OrganizationAIConfig {
  routing?: {
    default?: AITaskRoutingRule;
    tasks?: Record<string, AITaskRoutingRule>;
  };
  providers?: {
    gemini?: AIProviderConfig;
    openai?: AIProviderConfig;
  };
}

export interface ResolvedAIProviderConfig {
  provider: AIProviderName;
  model: string;
  providerSource: "task" | "default" | "auto";
  modelSource: "task" | "provider" | "task_default" | "system_default";
}

const GLOBAL_DEFAULT_MODELS: Record<AIProviderName, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4.1-mini",
};

const TASK_DEFAULT_MODELS: Partial<Record<AITaskName, Partial<Record<AIProviderName, string>>>> = {
  [AI_TASKS.invoiceTemplateGeneration]: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4.1-mini",
  },
  [AI_TASKS.emailTemplateGeneration]: {
    gemini: "gemini-2.0-flash",
    openai: "gpt-4.1-mini",
  },
  [AI_TASKS.invoiceDataExtraction]: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4.1-mini",
  },
  [AI_TASKS.invoiceTemplateFromExtractionGeneration]: {
    gemini: "gemini-2.5-pro",
    openai: "gpt-4.1",
  },
  [AI_TASKS.marketplaceMetadataEnrichment]: {
    gemini: "gemini-2.0-flash",
    openai: "gpt-4.1-mini",
  },
};

/**
 * Resolves provider/model for an AI task using org Firestore settings, and configures the global AI service.
 */
export function configureAIProviderForTask(params: {
  organization: Organization;
  task: AITaskName;
}): ResolvedAIProviderConfig {
  const { organization, task } = params;
  const aiSettings = normalizeAISettings(organization.settings?.ai);

  const taskRule = aiSettings.routing?.tasks?.[task];
  const defaultRule = aiSettings.routing?.default;

  const providerFromTask = normalizeProviderPreference(taskRule?.provider);
  const providerFromDefault = normalizeProviderPreference(defaultRule?.provider);
  const providerPreference: AIProviderPreference = providerFromTask ?? providerFromDefault ?? "auto";

  const modelFromTask = normalizeModelPreference(taskRule?.model);
  const modelFromDefault = normalizeModelPreference(defaultRule?.model);
  const modelPreference = modelFromTask ?? modelFromDefault ?? "auto";

  const providerSource: ResolvedAIProviderConfig["providerSource"] = providerFromTask
    ? "task"
    : providerFromDefault
      ? "default"
      : "auto";

  const provider = resolveProvider(providerPreference, aiSettings);
  const modelResolution = resolveModel({
    provider,
    task,
    modelPreference,
    aiSettings,
  });

  const apiKey = getApiKey(provider);
  const aiService = getAIService();

  if (provider === "gemini") {
    aiService.registerProvider(new GeminiProvider({ apiKey, model: modelResolution.model }));
  } else {
    aiService.registerProvider(new OpenAIProvider({ apiKey, model: modelResolution.model }));
  }

  aiService.setDefaultProvider(provider);

  logger.info("AI provider configured for task", {
    organizationId: organization.id,
    task,
    provider,
    model: modelResolution.model,
    providerSource,
    modelSource: modelResolution.source,
  });

  return {
    provider,
    model: modelResolution.model,
    providerSource,
    modelSource: modelResolution.source,
  };
}

function normalizeAISettings(raw: unknown): OrganizationAIConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as OrganizationAIConfig;
}

function normalizeProviderPreference(value: unknown): AIProviderPreference | null {
  if (value === "gemini" || value === "openai" || value === "auto") {
    return value;
  }
  return null;
}

function normalizeModelPreference(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isProviderEnabled(aiSettings: OrganizationAIConfig, provider: AIProviderName): boolean {
  const enabled = aiSettings.providers?.[provider]?.enabled;
  return enabled !== false;
}

function resolveProvider(
  providerPreference: AIProviderPreference,
  aiSettings: OrganizationAIConfig,
): AIProviderName {
  const candidates: AIProviderName[] = providerPreference === "auto"
    ? ["gemini", "openai"]
    : [providerPreference];

  const candidateResults = candidates.map((candidate) => {
    const enabled = isProviderEnabled(aiSettings, candidate);
    const key = enabled ? safeGetApiKey(candidate) : null;

    return {
      candidate,
      enabled,
      hasKey: !!key,
    };
  });

  const resolved = candidateResults.find((entry) => entry.enabled && entry.hasKey);
  if (resolved) {
    return resolved.candidate;
  }

  if (providerPreference !== "auto") {
    const entry = candidateResults[0];
    if (!entry.enabled) {
      throw new Error(
        `AI provider \"${providerPreference}\" is disabled in organization settings. Enable it or switch provider.`
      );
    }
    throw new Error(
      `AI provider \"${providerPreference}\" is selected but its API key secret is not configured.`
    );
  }

  throw new Error(
    "No AI provider is available. Configure GEMINI_API_KEY or OPENAI_API_KEY and ensure provider is enabled in organization settings."
  );
}

function resolveModel(params: {
  provider: AIProviderName;
  task: AITaskName;
  modelPreference: string;
  aiSettings: OrganizationAIConfig;
}): { model: string; source: ResolvedAIProviderConfig["modelSource"] } {
  const { provider, task, modelPreference, aiSettings } = params;

  if (modelPreference !== "auto") {
    return { model: modelPreference, source: "task" };
  }

  const providerModel = normalizeModelPreference(aiSettings.providers?.[provider]?.model);
  if (providerModel && providerModel !== "auto") {
    return { model: providerModel, source: "provider" };
  }

  const taskDefaultModel = TASK_DEFAULT_MODELS[task]?.[provider];
  if (taskDefaultModel) {
    return { model: taskDefaultModel, source: "task_default" };
  }

  return { model: GLOBAL_DEFAULT_MODELS[provider], source: "system_default" };
}

function safeGetApiKey(provider: AIProviderName): string | null {
  try {
    return getApiKey(provider);
  } catch {
    return null;
  }
}

function getApiKey(provider: AIProviderName): string {
  const apiKey = provider === "gemini" ? geminiApiKeySecret.value() : openAiApiKeySecret.value();
  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key secret is not configured`);
  }
  return apiKey;
}
