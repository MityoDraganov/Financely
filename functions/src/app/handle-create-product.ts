import { CreateProductInput, productDataSchema } from "../core/entities/product";
import { getDatabaseService } from "../services/database-service";
import { getProductRepository } from "../repositories/product-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandContextCache } from "../services/brand-context-cache";
import { ZodError } from "zod";
import { removeUndefinedValues } from "../utils/remove-undefined-values";
import { getOrganizationBaseCurrency } from "../utils/organization-currency-policy";

/**
 * Application handler for creating a product.
 *
 * This handler:
 * 1. Validates the incoming payload against the product schema
 * 2. Creates the product in the database
 * 3. Invalidates brand context cache for the organization
 * 4. Returns the created product ID
 *
 * @param {CreateProductInput} payload - The product creation payload
 * @return {Promise<string>} The created product ID
 * @throws Error if validation fails or database operation fails
 */
export async function handleCreateProduct(
  payload: CreateProductInput
): Promise<string> {
  try {
    const databaseService = getDatabaseService();
    const organizationRepository = getOrganizationRepository(databaseService);
    const organization = await organizationRepository.get({
      id: payload.organizationId,
    });
    if (!organization) {
      throw new Error(`Organization not found: ${payload.organizationId}`);
    }
    const organizationBaseCurrency = getOrganizationBaseCurrency(organization);

    const normalizedPayload = removeUndefinedValues({
      ...payload,
      currency: organizationBaseCurrency,
      description: payload.description ?? undefined,
      sku: payload.sku ?? undefined,
      barcode: payload.barcode ?? undefined,
      stockQuantity: payload.stockQuantity ?? undefined,
      lowStockThreshold: payload.lowStockThreshold ?? undefined,
      category: payload.category ?? undefined,
      weight: payload.weight ?? undefined,
      taxRate: payload.taxRate ?? undefined,
      cost: payload.cost ?? undefined,
      dimensions: payload.dimensions
        ? {
            ...payload.dimensions,
            length: payload.dimensions.length ?? undefined,
            width: payload.dimensions.width ?? undefined,
            height: payload.dimensions.height ?? undefined,
            unit: payload.dimensions.unit ?? undefined,
          }
        : undefined,
    });

    // Validate the payload
    const validatedData = productDataSchema.parse(normalizedPayload);

    // Get database service and repository
    const productRepository = getProductRepository(databaseService);

    // Create the product
    // Note: repository.create returns the document ID as a string
    const productId = await productRepository.create({ data: validatedData });

    if (!productId) {
      throw new Error("Failed to create product: No ID returned");
    }

    // Invalidate brand context cache for this organization
    const cache = getBrandContextCache();
    cache.invalidate(validatedData.organizationId);

    return productId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Product validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}
