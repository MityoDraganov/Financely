import { CreateProductMetafieldDefinitionInput, productMetafieldDefinitionDataSchema } from "../core/entities/product-metafield";
import { getDatabaseService } from "../services/database-service";
import { getProductMetafieldDefinitionRepository } from "../repositories/product-metafield-repository";
import { ZodError } from "zod";

export async function handleCreateProductMetafieldDefinition(
  payload: CreateProductMetafieldDefinitionInput
): Promise<string> {
  try {
    const validatedData = productMetafieldDefinitionDataSchema.parse(payload);

    const databaseService = getDatabaseService();
    const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);

    const definitionId = await productMetafieldDefinitionRepository.create({ data: validatedData });

    if (!definitionId) {
      throw new Error("Failed to create product metafield definition: No ID returned");
    }

    return definitionId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Product metafield definition validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}
