import { CreateProductInput, productDataSchema } from "../core/entities/product";
import { getDatabaseService } from "../services/database-service";
import { getProductRepository } from "../repositories/product-repository";
import { ZodError } from "zod";

/**
 * Application handler for creating a product.
 *
 * This handler:
 * 1. Validates the incoming payload against the product schema
 * 2. Creates the product in the database
 * 3. Returns the created product ID
 *
 * @param {CreateProductInput} payload - The product creation payload
 * @return {Promise<string>} The created product ID
 * @throws Error if validation fails or database operation fails
 */
export async function handleCreateProduct(
  payload: CreateProductInput
): Promise<string> {
  try {
    // Validate the payload
    const validatedData = productDataSchema.parse(payload);

    // Get database service and repository
    const databaseService = getDatabaseService();
    const productRepository = getProductRepository(databaseService);

    // Create the product
    // Note: repository.create returns the document ID as a string
    const productId = await productRepository.create({ data: validatedData });

    if (!productId) {
      throw new Error("Failed to create product: No ID returned");
    }

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

