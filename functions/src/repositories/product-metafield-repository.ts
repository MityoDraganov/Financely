import { ProductMetafieldDefinitionRepository, ProductMetafieldRepository, DatabaseService } from "../core";
import { ProductMetafieldDefinition, ProductMetafieldDefinitionData, ProductMetafield, ProductMetafieldData } from "../core/entities/product-metafield";
import { DatabaseCollection } from "./config";
import { getEntityMetafieldDefinitionRepository, getEntityMetafieldRepository } from "./entity-metafield-repository";

export function getProductMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ProductMetafieldDefinitionRepository {
  return getEntityMetafieldDefinitionRepository<ProductMetafieldDefinition, ProductMetafieldDefinitionData>(
    () => DatabaseCollection.PRODUCT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getProductMetafieldRepository(
  databaseService: DatabaseService,
): ProductMetafieldRepository {
  const genericRepo = getEntityMetafieldRepository<ProductMetafield, ProductMetafieldData>(
    () => DatabaseCollection.PRODUCT_METAFIELDS,
    "productId",
    databaseService,
  );

  return {
    ...genericRepo,
    async getByProductId(productId: string) {
      return genericRepo.getByEntityId(productId);
    },
  };
}
