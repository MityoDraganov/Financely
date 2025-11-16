/**
 * Service for mapping product data to invoice fields using AI
 * Intelligently maps product data to invoice template bindings based on field names
 */

import { AIService } from "./ai-service";
import { Product, Organization } from "../../core";
import { Template, TemplateElement } from "../../core/entities/template";
import { loggerService } from "../logger-service";
import type { InvoiceDataValue } from "../../core/entities/invoice";

export interface ProductToInvoiceMappingResult {
  mappedFields: Record<string, InvoiceDataValue>;
}

export class ProductToInvoiceService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Map product data to invoice fields based on template bindings
   */
  async mapProductToInvoiceFields(
    product: Product,
    template: Template,
    organization: Organization,
    currentFormData: Record<string, InvoiceDataValue>
  ): Promise<ProductToInvoiceMappingResult> {
    try {
      // Extract template bindings
      const templateBindings = this.extractTemplateBindings(template);
      
      // Build context for AI
      const context = this.buildMappingContext(product, organization, template);
      
      // Build AI prompt
      const prompt = this.buildMappingPrompt(context, templateBindings, template, currentFormData);
      
      // Define schema for AI response
      const schema = {
        type: "object" as const,
        properties: {
          mappedFields: {
            type: "object" as const,
            description: "Mapped product data to invoice field bindings",
          },
        },
        required: ["mappedFields"],
      };
      
      // Generate mapping using AI
      const result = await this.aiService.generateJSON<{
        mappedFields: Record<string, unknown>;
      }>(prompt, schema, {
        temperature: 0.2, // Low temperature for consistent mapping
        maxTokens: 4096,
      });
      
      return {
        mappedFields: result.mappedFields as Record<string, InvoiceDataValue>,
      };
    } catch (error) {
      loggerService.error("Failed to map product to invoice fields", {
        error: error instanceof Error ? error.message : "Unknown error",
        productId: product.id,
        templateId: template.id,
      });
      throw new Error(
        `Failed to map product to invoice fields: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract all bindings from template elements
   */
  private extractTemplateBindings(template: Template): Set<string> {
    const bindings = new Set<string>();
    const elements = template.elements ?? [];
    
    for (const element of elements) {
      if (element.type === "text" || element.type === "input" || element.type === "currency") {
        const binding = (element as Extract<TemplateElement, { type: "text" | "input" | "currency" }>).binding;
        if (binding) {
          bindings.add(binding);
        }
      } else if (element.type === "table") {
        const tableEl = element as Extract<TemplateElement, { type: "table" }>;
        if (tableEl.itemsBinding) {
          bindings.add(tableEl.itemsBinding);
        }
        for (const col of tableEl.columns ?? []) {
          if (col.binding) {
            bindings.add(`${tableEl.itemsBinding}[*].${col.binding}`);
          }
        }
      }
    }
    
    return bindings;
  }

  /**
   * Build context for AI mapping
   */
  private buildMappingContext(
    product: Product,
    organization: Organization,
    template: Template
  ): string {
    return `Organization Context:
- Name: ${organization.name}
- Default Currency: ${organization.settings?.defaultCurrency || "USD"}
- Address: ${organization.settings?.address ? JSON.stringify(organization.settings.address) : "Not set"}

Product Data:
- ID: ${product.id}
- Name: ${product.name}
- Description: ${product.description || "No description"}
- Price: ${product.price} ${product.currency}
- SKU: ${product.sku || "No SKU"}
- Category: ${product.category || "No category"}
- Stock Quantity: ${product.trackInventory && product.stockQuantity !== undefined ? product.stockQuantity : "Not tracked"}
- Track Inventory: ${product.trackInventory}
- Tax Rate: ${product.taxRate || 0}%
- Cost: ${product.cost || "Not set"}
- Images: ${product.images?.length || 0} image(s)
- Status: ${product.status}

Template Information:
- Template ID: ${template.id}
- Template Name: ${template.name}
- Template Description: ${template.description || "No description"}`;
  }

  /**
   * Build AI prompt for product to invoice field mapping
   */
  private buildMappingPrompt(
    context: string,
    templateBindings: Set<string>,
    template: Template,
    currentFormData: Record<string, InvoiceDataValue>
  ): string {
    const bindingsList = Array.from(templateBindings)
      .map(b => `- ${b}`)
      .join("\n");
    
    // Extract field labels from template elements for better context
    const fieldLabels: Array<{ binding: string; label: string; type: string }> = [];
    const elements = template.elements ?? [];
    
    for (const element of elements) {
      if (element.type === "text") {
        const textEl = element as Extract<TemplateElement, { type: "text" }>;
        if (textEl.binding) {
          fieldLabels.push({
            binding: textEl.binding,
            label: textEl.text || textEl.binding,
            type: "text",
          });
        }
      } else if (element.type === "input") {
        const inputEl = element as Extract<TemplateElement, { type: "input" }>;
        if (inputEl.binding) {
          fieldLabels.push({
            binding: inputEl.binding,
            label: inputEl.placeholder || inputEl.binding,
            type: inputEl.variant || "text",
          });
        }
      } else if (element.type === "currency") {
        const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
        if (currencyEl.binding) {
          fieldLabels.push({
            binding: currencyEl.binding,
            label: currencyEl.placeholder || currencyEl.binding,
            type: "currency",
          });
        }
      } else if (element.type === "table") {
        const tableEl = element as Extract<TemplateElement, { type: "table" }>;
        if (tableEl.itemsBinding) {
          for (const col of tableEl.columns ?? []) {
            if (col.binding) {
              fieldLabels.push({
                binding: `${tableEl.itemsBinding}[*].${col.binding}`,
                label: col.header || col.binding,
                type: col.type || "text",
              });
            }
          }
        }
      }
    }
    
    const fieldLabelsList = fieldLabels
      .map(f => `- ${f.binding} (${f.label}, type: ${f.type})`)
      .join("\n");
    
    return `You are an intelligent invoice field mapping assistant. Your task is to map product data to invoice template fields based on field names, labels, and semantic meaning.

${context}

Template Field Bindings Available:
${bindingsList}

Field Labels and Types:
${fieldLabelsList}

Current Form Data (for context only - product data will always overwrite existing values):
${JSON.stringify(currentFormData, null, 2)}

MAPPING RULES:
1. Analyze each template binding and determine if product data should populate it
2. Consider field names, labels, and semantic meaning (e.g., "price" → product.price, "description" → product.description)
3. For table items (items[*].*), create appropriate line items from product data
4. Map product price to appropriate price/amount fields
5. Map product currency to currency fields
6. Map product description to description fields
7. Map product SKU to SKU/reference fields
8. Map product name to item name/description fields
9. For quantity fields, use 1 as default (user can adjust)
10. ALWAYS overwrite existing form data values with product data when product data is available
11. Only map fields where product data is relevant - don't force mappings

COMMON MAPPINGS:
- Product name → items[*].description, items[*].name, itemDescription
- Product price → items[*].unitPrice, items[*].price, price, amount
- Product currency → items[*].currency, currency
- Product description → items[*].description, description
- Product SKU → items[*].sku, sku, reference, itemNumber
- Product category → category, itemCategory

OUTPUT FORMAT:
Return a JSON object with "mappedFields" containing only the fields that should be populated from product data.
Example:
{
  "mappedFields": {
    "items[0].description": "Premium Widget",
    "items[0].unitPrice": 99.99,
    "items[0].currency": "USD",
    "items[0].quantity": 1,
    "currency": "USD"
  }
}

IMPORTANT:
- Only include fields in mappedFields that should be populated from product data
- Use appropriate data types (numbers for prices, strings for text)
- For table items, use array index notation (items[0].field)
- Don't include fields that don't have relevant product data
- ALWAYS overwrite existing form data with product data when product data is available and relevant`;
  }
}

