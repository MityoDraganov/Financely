import { AIService, getAIService } from "./ai-service";

export interface BusinessInterpretationResult {
  businessType: string;
  industry: string;
  suggestedServices: string[];
  documentTypes: string[];
  templateKeywords: string[];
}

let serviceInstance: OnboardingInterpretationService | null = null;

export class OnboardingInterpretationService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  async interpretBusinessDescription(description: string): Promise<BusinessInterpretationResult> {
    const prompt = `You are a business analyst. Analyze the following business description and extract structured information.

Business description: "${description}"

Return a JSON object with:
- businessType: Short label for the business type (e.g. "Marketing Agency", "E-commerce Store", "Legal Consulting Firm", "Software Development Studio")
- industry: Industry category (e.g. "Marketing & Advertising", "Retail & E-commerce", "Legal Services", "Technology")
- suggestedServices: Array of 3-5 specific services/products this business likely offers (short labels, e.g. "SEO Optimization", "Google Ads Management")
- documentTypes: Array of document types this business needs (from: "invoice", "proposal", "email") - maximum 3
- templateKeywords: Array of 3-6 keywords useful for finding relevant document templates (e.g. "agency", "consulting", "service", "retainer")

Be concise and practical. Return only valid JSON.`;

    const schema = {
      type: "object" as const,
      properties: {
        businessType: { type: "string" as const },
        industry: { type: "string" as const },
        suggestedServices: { type: "array" as const, items: { type: "string" as const } },
        documentTypes: { type: "array" as const, items: { type: "string" as const } },
        templateKeywords: { type: "array" as const, items: { type: "string" as const } },
      },
      required: ["businessType", "industry", "suggestedServices", "documentTypes", "templateKeywords"],
    };

    const result = await this.aiService.generateJSON<BusinessInterpretationResult>(
      prompt,
      schema,
      { temperature: 0.3, maxTokens: 512 }
    );

    return result;
  }
}

export function getOnboardingInterpretationService(): OnboardingInterpretationService {
  if (!serviceInstance) {
    serviceInstance = new OnboardingInterpretationService();
  }
  return serviceInstance;
}
