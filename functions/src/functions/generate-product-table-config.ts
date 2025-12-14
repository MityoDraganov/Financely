/**
 * Firebase Cloud Function for generating product table configuration using AI.
 * 
 * This function uses AI to intelligently map product entity fields to invoice table columns
 * based on column names, types, and bindings.
 * 
 * Request payload:
 * {
 *   templateId: string,
 *   organizationId: string,
 *   itemsBinding: string (e.g., "items")
 * }
 * 
 * Response: ProductTableConfig object
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import type { Template, TemplateElement, ProductTableConfig } from "../core/entities/template";
import { loggerService } from "../services/logger-service";
import { formatProductFieldsForAI } from "../utils/product-fields";

interface GenerateProductTableConfigPayload {
  templateId: string;
  organizationId: string;
  itemsBinding: string;
}

interface GenerateProductTableConfigResponse {
  productTableConfig: ProductTableConfig;
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const generateProductTableConfig = onCall<
  GenerateProductTableConfigPayload,
  Promise<GenerateProductTableConfigResponse>
>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
  },
  async (request) => {
    try {
      const { templateId, organizationId, itemsBinding } = request.data;

      if (!templateId || !organizationId || !itemsBinding) {
        throw new HttpsError(
          "invalid-argument",
          "templateId, organizationId, and itemsBinding are required"
        );
      }

      logger.info("Generating product table config", {
        templateId,
        organizationId,
        itemsBinding,
      });

      // Fetch template from Realtime Database
      const template = await realtimeDatabaseService.get<Template>("templates", templateId);
      if (!template) {
        throw new HttpsError("not-found", `Template not found: ${templateId}`);
      }

      // Verify template belongs to organization
      if (template.orgId !== organizationId) {
        throw new HttpsError(
          "permission-denied",
          "Template does not belong to this organization"
        );
      }

      // Fetch organization
      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);
      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new HttpsError("not-found", `Organization not found: ${organizationId}`);
      }

      // Find the table element
      const tableElement = (template.elements ?? []).find(
        (el: TemplateElement): el is Extract<TemplateElement, { type: "table" }> =>
          el.type === "table" &&
          (el as Extract<TemplateElement, { type: "table" }>).itemsBinding === itemsBinding
      );

      if (!tableElement || !tableElement.columns || tableElement.columns.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          `Table with itemsBinding "${itemsBinding}" not found or has no columns`
        );
      }

      // Initialize AI service
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured"
        );
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.0-flash-exp",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Build prompt for AI
      const currency = organization.settings?.defaultCurrency || "USD";
      const columnsInfo = tableElement.columns.map((col: typeof tableElement.columns[0], idx: number) => ({
        index: idx,
        id: col.id,
        header: col.header || col.binding || col.id,
        binding: col.binding || col.id,
        type: col.type || "text",
        currency: "currency" in col ? col.currency : undefined,
      }));

      const prompt = `You are an AI assistant that generates product table configuration mappings for invoice templates.

Product Entity Fields Available:
${formatProductFieldsForAI()}

Table Information:
- Items Binding: ${itemsBinding}
- Organization Default Currency: ${currency}
- Number of Columns: ${tableElement.columns.length}

Table Columns:
${columnsInfo.map((col) => 
  `  ${col.index + 1}. Column "${col.header}" (binding: "${col.binding}", type: "${col.type}"${col.currency ? `, currency: "${col.currency}"` : ""})`
).join("\n")}

Your Task:
Generate a ProductTableConfig that maps product entity fields to the table columns above.

Mapping Rules:
1. Analyze each column's header, binding, and type to determine the best product field match
2. Common mappings:
   - Columns with "description", "name", "item" in header/binding → product.description or product.name
   - Columns with "price", "amount", "unit" in header/binding and type "currency" or "number" → product.price (with currency_convert if column has currency)
   - Columns with "currency" in header/binding and type "text" → product.currency
   - Columns with "sku", "reference", "item number" in header/binding → product.sku
   - Columns with "category" in header/binding → product.category
   - Columns with "tax" and "rate" in header/binding → product.taxRate
   - Columns with "cost" in header/binding → product.cost
3. For price columns:
   - If column type is "currency" and has a currency code, use transform: "currency_convert" and set targetCurrency
   - If column type is "number", use transform: "format_number"
   - Otherwise use transform: "none"
4. Set lockOnProductSelect: true for all mappings (fields should be locked when product is selected)
5. Set autoQuantity: false (users set quantity manually)
6. Set autoConvertCurrency: true
7. Set defaultCurrency to "${currency}"

Output Format:
Return a JSON object with this structure:
{
  "itemsBinding": "${itemsBinding}",
  "columnMappings": [
    {
      "columnBinding": "column-binding-name",
      "productField": "name|description|price|currency|sku|barcode|category|taxRate|cost",
      "transform": "none|currency_convert|format_number",
      "targetCurrency": "USD" (only if transform is "currency_convert"),
      "lockOnProductSelect": true
    }
  ],
  "autoQuantity": false,
  "defaultQuantity": 1,
  "autoConvertCurrency": true,
  "defaultCurrency": "${currency}"
}

Generate mappings for ALL columns that can be mapped to product fields. Only include columns that have a clear product field match.`;

      // Define schema for AI response
      const schema = {
        type: "object" as const,
        properties: {
          itemsBinding: { type: "string" as const },
          columnMappings: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                columnBinding: { type: "string" as const },
                productField: {
                  type: "string" as const,
                  enum: ["name", "description", "price", "currency", "sku", "barcode", "category", "taxRate", "cost"],
                },
                transform: {
                  type: "string" as const,
                  enum: ["none", "currency_convert", "format_number"],
                },
                targetCurrency: { type: "string" as const },
                lockOnProductSelect: { type: "boolean" as const },
              },
              required: ["columnBinding", "productField"],
            },
          },
          autoQuantity: { type: "boolean" as const },
          defaultQuantity: { type: "number" as const },
          autoConvertCurrency: { type: "boolean" as const },
          defaultCurrency: { type: "string" as const },
        },
        required: ["itemsBinding", "columnMappings"],
      };

      // Generate configuration using AI
      const result = await aiService.generateJSON<{
        itemsBinding: string;
        columnMappings: Array<{
          columnBinding: string;
          productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost";
          transform?: "none" | "currency_convert" | "format_number";
          targetCurrency?: string;
          lockOnProductSelect?: boolean;
        }>;
        autoQuantity?: boolean;
        defaultQuantity?: number;
        autoConvertCurrency?: boolean;
        defaultCurrency?: string;
      }>(prompt, schema, {
        temperature: 0.2, // Low temperature for consistent mapping
        maxTokens: 4096,
      });

      // Validate and normalize the result
      const productTableConfig: ProductTableConfig = {
        itemsBinding: result.itemsBinding,
        columnMappings: result.columnMappings.map(m => ({
          columnBinding: m.columnBinding,
          productField: m.productField,
          transform: m.transform || "none",
          targetCurrency: m.targetCurrency,
          lockOnProductSelect: m.lockOnProductSelect !== false, // Default to true
        })),
        autoQuantity: result.autoQuantity || false,
        defaultQuantity: result.defaultQuantity || 1,
        autoConvertCurrency: result.autoConvertCurrency !== false, // Default to true
        defaultCurrency: result.defaultCurrency || currency,
      };

      logger.info("Product table config generated successfully", {
        templateId,
        itemsBinding,
        mappingCount: productTableConfig.columnMappings.length,
      });

      return { productTableConfig };
    } catch (error) {
      loggerService.error("Failed to generate product table config", {
        error: error instanceof Error ? error.message : "Unknown error",
        templateId: request.data.templateId,
        organizationId: request.data.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to generate product table config: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

