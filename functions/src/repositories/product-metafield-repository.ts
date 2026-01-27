import { ProductMetafieldDefinitionRepository, ProductMetafieldRepository, DatabaseService } from "../core";
import { ProductMetafieldDefinition, ProductMetafieldDefinitionData, ProductMetafield, ProductMetafieldData } from "../core/entities/product-metafield";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getProductMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ProductMetafieldDefinitionRepository {
  return getGenericRepository<ProductMetafieldDefinition, ProductMetafieldDefinitionData>(
    () => DatabaseCollection.PRODUCT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getProductMetafieldRepository(
  databaseService: DatabaseService,
): ProductMetafieldRepository {
  const genericRepo = getGenericRepository<ProductMetafield, ProductMetafieldData>(
    () => DatabaseCollection.PRODUCT_METAFIELDS,
    databaseService,
  );

  return {
    ...genericRepo,
    async getByProductId(productId: string) {
      const result = await databaseService.getAllByFields<ProductMetafield>(
        DatabaseCollection.PRODUCT_METAFIELDS,
        [{ field: "productId", operator: "==", value: productId }],
        {},
      );
      return result || [];
    },
    async getByDefinitionId(definitionId: string) {
      const result = await databaseService.getAllByFields<ProductMetafield>(
        DatabaseCollection.PRODUCT_METAFIELDS,
        [{ field: "definitionId", operator: "==", value: definitionId }],
        {},
      );
      return result || [];
    },
  };
}
