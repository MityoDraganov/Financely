import { ProductMetafieldDefinitionRepository, ProductMetafieldRepository, DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getProductMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ProductMetafieldDefinitionRepository {
  return getGenericRepository<import("@/core").ProductMetafieldDefinition, import("@/core").ProductMetafieldDefinitionData>(
    () => DatabaseCollection.PRODUCT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getProductMetafieldRepository(
  databaseService: DatabaseService,
): ProductMetafieldRepository {
  const genericRepo = getGenericRepository<import("@/core").ProductMetafield, import("@/core").ProductMetafieldData>(
    () => DatabaseCollection.PRODUCT_METAFIELDS,
    databaseService,
  );

  return {
    ...genericRepo,
    async getByProductId(productId: string) {
      const result = await databaseService.getPaginated({
        collection: DatabaseCollection.PRODUCT_METAFIELDS,
        filters: [{ field: "productId", operator: "==", value: productId }],
      });
      return result || [];
    },
    async getByDefinitionId(definitionId: string) {
      const result = await databaseService.getPaginated({
        collection: DatabaseCollection.PRODUCT_METAFIELDS,
        filters: [{ field: "definitionId", operator: "==", value: definitionId }],
      });
      return result || [];
    },
  };
}
