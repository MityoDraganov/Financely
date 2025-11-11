import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { Lead, ProposalData, ProposalItem, PROPOSAL_STATUSES } from "../../core";
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
   * Only uses existing products from the organization
   * Marks proposal as incomplete if products don't exist
   */
  async generateProposalSuggestion(
    lead: Lead,
    organizationName?: string,
    products?: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>
  ): Promise<ProposalData> {
    const leadData = lead.data || lead;
    
    // Build context from lead data
    const context = this.buildLeadContext(leadData, organizationName, products);
    
    // Create prompt for AI (with products for strict validation)
    const prompt = this.buildProposalPrompt(context, products);
    
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
      
      // Validate items against existing products
      const { validatedItems, incompleteItems, isIncomplete } = this.validateItemsAgainstProducts(
        result.items,
        products || []
      );
      
      // Calculate totals
      const items: ProposalItem[] = validatedItems.map((item) => ({
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
        isIncomplete,
        incompleteItems: incompleteItems.length > 0 ? incompleteItems : undefined,
      };
      
      return proposalData;
    } catch (error) {
      logger.error("Failed to generate proposal suggestion", {
        error: error instanceof Error ? error.message : "Unknown error",
        leadId: lead.id,
      });
      throw new Error(
        `Failed to generate proposal suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validate AI-generated items against existing products
   * Returns validated items, incomplete items, and completion status
   */
  private validateItemsAgainstProducts(
    aiItems: Array<{ description: string; qty: number; unitPrice: number; taxPct?: number }>,
    products: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>
  ): {
    validatedItems: Array<{ description: string; qty: number; unitPrice: number; taxPct?: number }>;
    incompleteItems: Array<{ description: string; reason: string; suggestedProductId?: string }>;
    isIncomplete: boolean;
  } {
    if (!products || products.length === 0) {
      // No products available - mark all items as incomplete
      return {
        validatedItems: [],
        incompleteItems: aiItems.map(item => ({
          description: item.description,
          reason: "No products available in organization. Products must be created first.",
        })),
        isIncomplete: true,
      };
    }

    const validatedItems: Array<{ description: string; qty: number; unitPrice: number; taxPct?: number }> = [];
    const incompleteItems: Array<{ description: string; reason: string; suggestedProductId?: string }> = [];

    for (const aiItem of aiItems) {
      // Try to find a matching product
      const matchedProduct = this.findMatchingProduct(aiItem.description, products);
      
      if (matchedProduct) {
        // Item matches a product - use product's exact price
        validatedItems.push({
          description: matchedProduct.name, // Use product name, not AI description
          qty: aiItem.qty,
          unitPrice: matchedProduct.price, // Use product price, not AI price
          taxPct: aiItem.taxPct || 0,
        });
      } else {
        // Item doesn't match any product - mark as incomplete
        const suggestedProduct = this.findSimilarProduct(aiItem.description, products);
        incompleteItems.push({
          description: aiItem.description,
          reason: `Product "${aiItem.description}" not found in organization's product catalog.`,
          suggestedProductId: suggestedProduct?.id,
        });
      }
    }

    return {
      validatedItems,
      incompleteItems,
      isIncomplete: incompleteItems.length > 0,
    };
  }

  /**
   * Find a product that matches the item description
   * Uses fuzzy matching to find products by name or description
   */
  private findMatchingProduct(
    itemDescription: string,
    products: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>
  ): { id?: string; name: string; description?: string; price: number; currency: string; category?: string } | null {
    if (!itemDescription || !products || products.length === 0) {
      return null;
    }

    const normalizedDescription = itemDescription.toLowerCase().trim();

    // First, try exact name match
    let match = products.find(p => 
      p.name.toLowerCase().trim() === normalizedDescription
    );
    if (match) return match;

    // Try partial name match (item description contains product name or vice versa)
    match = products.find(p => {
      const productName = p.name.toLowerCase().trim();
      return normalizedDescription.includes(productName) || 
             productName.includes(normalizedDescription) ||
             (p.description && (
               normalizedDescription.includes(p.description.toLowerCase().trim()) ||
               p.description.toLowerCase().trim().includes(normalizedDescription)
             ));
    });
    if (match) return match;

    // Try keyword matching (check if key words from product name appear in description)
    const itemWords = normalizedDescription.split(/\s+/).filter(w => w.length > 3);
    match = products.find(p => {
      const productName = p.name.toLowerCase();
      return itemWords.some(word => productName.includes(word));
    });
    if (match) return match;

    return null;
  }

  /**
   * Find a similar product (for suggestions)
   */
  private findSimilarProduct(
    itemDescription: string,
    products: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>
  ): { id?: string; name: string; description?: string; price: number; currency: string; category?: string } | null {
    // Use the same matching logic but return the first partial match
    return this.findMatchingProduct(itemDescription, products);
  }

  /**
   * Build context string from lead data
   */
  private buildLeadContext(
    leadData: Lead["data"],
    organizationName?: string,
    products?: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>
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
    
    // Products context is now handled in buildProposalPrompt for stricter validation
    
    return parts.join("\n");
  }

  /**
   * Build the prompt for AI proposal generation
   */
  private buildProposalPrompt(context: string, products?: Array<{ id?: string; name: string; description?: string; price: number; currency: string; category?: string }>): string {
    const hasProducts = products && products.length > 0;
    const productsSection = hasProducts 
      ? `\n\nCRITICAL: Available Products/Services (YOU MUST ONLY USE THESE):
${products.map((p, idx) => `${idx + 1}. Name: "${p.name}"${p.description ? ` | Description: ${p.description}` : ""} | Price: ${p.price} ${p.currency}${p.category ? ` | Category: ${p.category}` : ""}`).join("\n")}

STRICT RULES:
- You MUST ONLY create proposal items that match the available products listed above
- Use the EXACT product name from the list above
- Use the EXACT price from the product list
- Use the EXACT currency from the product list
- DO NOT create items for products that are NOT in the list above
- DO NOT invent or hallucinate products that don't exist
- If the lead's request doesn't match any available products, you may still create a proposal but ONLY use products from the list that are closest to their needs
- If you cannot match the lead's needs to any product, create a proposal with the closest matching products and note that manual review is needed`
      : `\n\nWARNING: No products are available for this organization. You should create a proposal with generic items, but note that manual review and product creation will be required.`;

    return `You are a professional proposal generator. Based on the following lead information, create a detailed business proposal.

Lead Information:
${context}${productsSection}

Please generate a professional proposal that includes:
1. A clear, compelling title
2. A brief description of the proposed services/products
3. A list of items/services with:
   - Clear descriptions (MUST match available products if listed above)
   - Reasonable quantities
   - Exact prices from available products (if products are listed)
   - Appropriate tax percentages (if applicable)
4. Appropriate payment terms
5. Any relevant notes

${hasProducts ? "CRITICAL: You MUST only use products from the available products list. Do not invent or create items for products that don't exist. If the lead's needs don't match available products exactly, use the closest matching products." : "Since no products are available, create generic proposal items that will need to be completed manually with actual products."}

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

