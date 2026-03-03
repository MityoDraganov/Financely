import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { AI_TASKS } from "../services/ai/provider-routing";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface EnrichedMetadata {
  shortDescription: string;
  description: string;
  category: string;
  tags: string[];
  language: string;
  country: string;
}

const ENRICHMENT_SCHEMA = {
  type: "object" as const,
  required: ["shortDescription", "description", "category", "tags", "language", "country"],
  properties: {
    shortDescription: {
      type: "string" as const,
      description: "One sentence (max 120 chars) describing what this template is for",
    },
    description: {
      type: "string" as const,
      description: "2-3 sentence description of the template's purpose, style, and ideal use case",
    },
    category: {
      type: "string" as const,
      description: "Single category name, e.g. 'Professional Services', 'Retail', 'Freelance', 'Healthcare', 'Construction', 'E-commerce'",
    },
    tags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3-7 lowercase keyword tags for search and filtering",
    },
    language: {
      type: "string" as const,
      description: "Language of the template text content, e.g. 'English', 'Spanish', 'French'",
    },
    country: {
      type: "string" as const,
      description: "Country or region this template is best suited for, or 'Global' if universal",
    },
  },
};

/**
 * Builds a compact content summary from the template's stored content.
 * Extracts only what is useful for categorisation — text labels, binding names,
 * element types — to avoid sending the full multi-KB structure to the AI.
 */
function buildContentSummary(templateContent: Record<string, unknown>, type: string): string {
  const lines: string[] = [`Template type: ${type}`];

  const elements = (templateContent.elements as unknown[]) || [];
  const textLabels: string[] = [];
  const bindingNames: Set<string> = new Set();
  const elementTypes: Set<string> = new Set();

  for (const el of elements) {
    const element = el as Record<string, unknown>;
    if (element.type) elementTypes.add(String(element.type));
    if (element.text && typeof element.text === "string" && element.text.trim()) {
      textLabels.push(element.text.trim().slice(0, 60));
    }
    if (element.binding && typeof element.binding === "string") {
      bindingNames.add(element.binding);
    }
  }

  const blocksV2 = (templateContent.blocksV2 as unknown[]) || [];
  for (const block of blocksV2) {
    const b = block as Record<string, unknown>;
    if (b.type) elementTypes.add(String(b.type));
  }

  if (elementTypes.size > 0) {
    lines.push(`Element types present: ${[...elementTypes].join(", ")}`);
  }
  if (textLabels.length > 0) {
    lines.push(`Text labels (sample): ${textLabels.slice(0, 15).join(" | ")}`);
  }
  if (bindingNames.size > 0) {
    lines.push(`Data bindings: ${[...bindingNames].slice(0, 10).join(", ")}`);
  }

  if (templateContent.name && typeof templateContent.name === "string") {
    lines.push(`Template name: ${templateContent.name}`);
  }
  if (templateContent.description && typeof templateContent.description === "string") {
    lines.push(`Template description: ${String(templateContent.description).slice(0, 200)}`);
  }

  return lines.join("\n");
}

export const onMarketplaceTemplateCreated = onDocumentCreated(
  {
    document: "marketplaceTemplates/{templateId}",
    region: "us-central1",
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (event) => {
    const db = getFirestore();
    const templateId = event.params.templateId;
    const data = event.data?.data();

    if (!data) {
      logger.warn("onMarketplaceTemplateCreated: no document data", { templateId });
      return;
    }

    // Only enrich templates that are awaiting enrichment
    if (data.aiEnrichmentStatus !== "pending") {
      logger.info("onMarketplaceTemplateCreated: skipping, not pending", {
        templateId,
        status: data.aiEnrichmentStatus,
      });
      return;
    }

    const docRef = db.collection("marketplaceTemplates").doc(templateId);

    // Mark as processing immediately to prevent double-enrichment on retries
    await docRef.update({ aiEnrichmentStatus: "processing" });

    try {
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY secret is not configured");
      }

      const aiService = getAIService();
      aiService.registerProvider(new GeminiProvider({ apiKey, model: "gemini-2.0-flash" }));
      aiService.setDefaultProvider("gemini");

      const contentSummary = buildContentSummary(
        data.templateContent as Record<string, unknown>,
        data.type as string,
      );

      const prompt = `You are a marketplace metadata specialist for a financial document platform called Financely.

Analyse the following ${data.type} template and generate accurate marketplace metadata for it.

Template title: "${data.title}"
${contentSummary}

Generate metadata that will help users discover this template when searching the marketplace.
Be specific and accurate based on the template content, not generic.
For tags, use lowercase single words or short hyphenated phrases.
For language/country, infer from text content if possible, otherwise use "English" and "Global".`;

      logger.info("onMarketplaceTemplateCreated: calling AI for enrichment", {
        templateId,
        task: AI_TASKS.marketplaceMetadataEnrichment,
      });

      const metadata = await aiService.generateJSON<EnrichedMetadata>(
        prompt,
        ENRICHMENT_SCHEMA,
        { temperature: 0.3 },
      );

      await docRef.update({
        shortDescription: metadata.shortDescription || null,
        description: metadata.description || null,
        category: metadata.category || null,
        tags: Array.isArray(metadata.tags) ? metadata.tags.slice(0, 10) : [],
        language: metadata.language || null,
        country: metadata.country || null,
        aiEnrichmentStatus: "done",
      });

      logger.info("onMarketplaceTemplateCreated: enrichment complete", { templateId });
    } catch (error) {
      logger.error("onMarketplaceTemplateCreated: enrichment failed", {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      await docRef.update({ aiEnrichmentStatus: "failed" });
    }
  },
);
