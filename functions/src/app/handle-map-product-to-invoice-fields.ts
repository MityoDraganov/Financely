import { getDatabaseService } from "../services/database-service";
import { getProductRepository } from "../repositories/product-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getAIService } from "../services/ai/ai-service";
import { ProductToInvoiceService } from "../services/ai/product-to-invoice-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { Template } from "../core/entities/template";
import type { InvoiceDataValue } from "../core/entities/invoice";

interface MapProductToInvoiceFieldsInput {
  productId: string;
  templateId: string;
  organizationId: string;
  currentFormData: Record<string, unknown>;
}

interface MapProductToInvoiceFieldsOutput {
  mappedFields: Record<string, InvoiceDataValue>;
}

// Get Gemini API key from environment
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Application handler for mapping product data to invoice fields using AI.
 *
 * This handler:
 * 1. Fetches the product, template, and organization
 * 2. Uses AI to intelligently map product data to invoice template fields
 * 3. Returns the mapped fields
 *
 * @param {MapProductToInvoiceFieldsInput} input - The mapping input
 * @return {Promise<MapProductToInvoiceFieldsOutput>} The mapped fields
 * @throws Error if product/template/organization not found or mapping fails
 */
export async function handleMapProductToInvoiceFields(
  input: MapProductToInvoiceFieldsInput
): Promise<MapProductToInvoiceFieldsOutput> {
  try {
    // Get database service and repositories
    const databaseService = getDatabaseService();
    const productRepository = getProductRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);

    // Fetch product
    const product = await productRepository.get({ id: input.productId });
    if (!product) {
      throw new Error(`Product not found: ${input.productId}`);
    }

    // Fetch template from Realtime Database (templates are stored in RTDB, not Firestore)
    const template = await realtimeDatabaseService.get<Template>("templates", input.templateId);
    if (!template) {
      loggerService.error("Template not found in Realtime Database", {
        templateId: input.templateId,
        organizationId: input.organizationId,
      });
      throw new Error(`Template not found: ${input.templateId}`);
    }

    // Verify template belongs to organization
    if (template.orgId !== input.organizationId) {
      loggerService.error("Template organization mismatch", {
        templateId: input.templateId,
        templateOrgId: template.orgId,
        requestedOrgId: input.organizationId,
      });
      throw new Error("Template does not belong to this organization");
    }

    // Fetch organization
    const organization = await organizationRepository.get({ id: input.organizationId });
    if (!organization) {
      throw new Error(`Organization not found: ${input.organizationId}`);
    }

    // Initialize AI service with Gemini provider
    const aiService = getAIService();
    const apiKey = geminiApiKey.value();
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
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

    // Create product to invoice service
    const productToInvoiceService = new ProductToInvoiceService(aiService);

    // Map product to invoice fields
    const result = await productToInvoiceService.mapProductToInvoiceFields(
      product,
      template,
      organization,
      input.currentFormData as Record<string, InvoiceDataValue>
    );

    return result;
  } catch (error) {
    loggerService.error("Failed to map product to invoice fields", {
      error: error instanceof Error ? error.message : "Unknown error",
      productId: input.productId,
      templateId: input.templateId,
    });

    throw error;
  }
}

