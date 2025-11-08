import { AIService } from "@/core/ports/services/ai-service";
import { Lead, ProposalData, ProposalItem, PROPOSAL_STATUSES } from "@/core";
import { getAIService } from "./ai-service";

/**
 * Service for generating proposal suggestions using AI
 */
export class ProposalGenerationService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate a proposal suggestion based on a lead
   */
  async generateProposalSuggestion(
    lead: Lead,
    organizationName?: string,
    products?: Array<{ name: string; description?: string; price: number; currency: string; category?: string }>
  ): Promise<ProposalData> {
    const leadData = lead.data || lead;
    
    // Build context from lead data
    const context = this.buildLeadContext(leadData, organizationName, products);
    
    // Create prompt for AI
    const prompt = this.buildProposalPrompt(context);
    
    // Define the expected JSON schema for proposal data
    const schema = {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Proposal title" },
        description: { type: "string" as const, description: "Proposal description" },
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              description: { type: "string" as const },
              qty: { type: "number" as const },
              unitPrice: { type: "number" as const },
              taxPct: { type: "number" as const },
            },
            required: ["description", "qty", "unitPrice"],
          },
        },
        currency: { type: "string" as const, description: "Currency code (e.g., USD, EUR)" },
        terms: { type: "string" as const, description: "Payment terms" },
        notes: { type: "string" as const, description: "Additional notes" },
      },
      required: ["title", "items", "currency"],
    };
    
    try {
      const result = await this.aiService.generateJSON<{
        title: string;
        description?: string;
        items: Array<{
          description: string;
          qty: number;
          unitPrice: number;
          taxPct?: number;
        }>;
        currency: string;
        terms?: string;
        notes?: string;
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 8192, // Increased to allow for full JSON response
      });
      
      // Calculate totals
      const items: ProposalItem[] = result.items.map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        taxPct: item.taxPct || 0,
      }));
      
      const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
      const taxTotal = items.reduce(
        (sum, item) => sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
        0
      );
      const total = subtotal + taxTotal;
      
      // Build proposal data
      const proposalData: ProposalData = {
        organizationId: leadData.organizationId,
        leadId: lead.id,
        title: result.title,
        description: result.description,
        status: PROPOSAL_STATUSES.DRAFT,
        items,
        subtotal,
        taxTotal,
        total,
        currency: result.currency || "USD",
        terms: result.terms,
        notes: result.notes,
        aiGenerated: true,
      };
      
      return proposalData;
    } catch (error) {
      console.error("Failed to generate proposal suggestion:", error);
      throw new Error(
        `Failed to generate proposal suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Build context string from lead data
   */
  private buildLeadContext(
    leadData: Lead["data"],
    organizationName?: string,
    products?: Array<{ name: string; description?: string; price: number; currency: string; category?: string }>
  ): string {
    const parts: string[] = [];
    
    if (organizationName) {
      parts.push(`Organization: ${organizationName}`);
    }
    
    if (leadData.firstName || leadData.lastName) {
      parts.push(`Contact: ${leadData.firstName || ""} ${leadData.lastName || ""}`.trim());
    }
    
    if (leadData.company) {
      parts.push(`Company: ${leadData.company}`);
    }
    
    if (leadData.email) {
      parts.push(`Email: ${leadData.email}`);
    }
    
    if (leadData.phone) {
      parts.push(`Phone: ${leadData.phone}`);
    }
    
    if (leadData.message) {
      parts.push(`Message/Request: ${leadData.message}`);
    }
    
    if (leadData.formData && Object.keys(leadData.formData).length > 0) {
      parts.push(`Additional Form Data: ${JSON.stringify(leadData.formData, null, 2)}`);
    }
    
    if (leadData.widgetType) {
      parts.push(`Widget Type: ${leadData.widgetType}`);
    }
    
    // Add products context
    if (products && products.length > 0) {
      parts.push("\nAvailable Products/Services:");
      products.forEach((product) => {
        const productInfo = [
          `- ${product.name}`,
          product.description ? `  Description: ${product.description}` : null,
          `  Price: ${product.price} ${product.currency}`,
          product.category ? `  Category: ${product.category}` : null,
        ].filter(Boolean).join("\n");
        parts.push(productInfo);
      });
      parts.push("\nWhen creating proposal items, prioritize using these available products/services and their pricing. Match products to the lead's needs based on their message and requirements.");
    }
    
    return parts.join("\n");
  }

  /**
   * Build the prompt for AI proposal generation
   */
  private buildProposalPrompt(context: string): string {
    return `You are a professional proposal generator. Based on the following lead information, create a detailed business proposal.

Lead Information:
${context}

Please generate a professional proposal that includes:
1. A clear, compelling title
2. A brief description of the proposed services/products
3. A list of items/services with:
   - Clear descriptions (prefer using available products/services if they match the lead's needs)
   - Reasonable quantities
   - Fair market prices (use the prices from available products if applicable, otherwise use realistic market rates)
   - Appropriate tax percentages (if applicable)
4. Appropriate payment terms
5. Any relevant notes

Make the proposal professional, detailed, and tailored to the lead's needs based on their message and form data. If available products/services are listed, prioritize using those products with their specified pricing when they match the lead's requirements. Otherwise, use realistic pricing that makes sense for the type of request.

Respond with a JSON object containing the proposal data.`;
  }
}

// Export singleton instance
let proposalGenerationServiceInstance: ProposalGenerationService | null = null;

/**
 * Get or create the proposal generation service instance
 */
export function getProposalGenerationService(): ProposalGenerationService {
  if (!proposalGenerationServiceInstance) {
    proposalGenerationServiceInstance = new ProposalGenerationService();
  }
  return proposalGenerationServiceInstance;
}

