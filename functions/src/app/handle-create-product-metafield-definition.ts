import { CreateProductMetafieldDefinitionInput, productMetafieldDefinitionDataSchema } from "../core/entities/product-metafield";
import { getDatabaseService } from "../services/database-service";
import { getProductMetafieldDefinitionRepository } from "../repositories/product-metafield-repository";
import { handleCreateEntityMetafieldDefinition } from "./handle-create-entity-metafield-definition";

export async function handleCreateProductMetafieldDefinition(
  payload: CreateProductMetafieldDefinitionInput
): Promise<string> {
  return handleCreateEntityMetafieldDefinition({
    payload,
    entityLabel: "Product",
    schema: productMetafieldDefinitionDataSchema,
    getRepository: () => getProductMetafieldDefinitionRepository(getDatabaseService()),
  });
}
