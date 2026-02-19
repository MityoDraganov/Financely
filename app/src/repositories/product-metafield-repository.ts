import { ProductMetafieldDefinitionRepository, ProductMetafieldRepository, DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getEntityMetafieldDefinitionRepository, getEntityMetafieldRepository } from "./entity-metafield-repository";

export function getProductMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ProductMetafieldDefinitionRepository {
  return getEntityMetafieldDefinitionRepository<import("@/core").ProductMetafieldDefinition, import("@/core").ProductMetafieldDefinitionData>(
    () => DatabaseCollection.PRODUCT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getProductMetafieldRepository(
  databaseService: DatabaseService,
): ProductMetafieldRepository {
  const genericRepo = getEntityMetafieldRepository<import("@/core").ProductMetafield, import("@/core").ProductMetafieldData>(
    () => DatabaseCollection.PRODUCT_METAFIELDS,
    "productId",
    databaseService,
  );

  return {
    ...genericRepo,
    async getByProductId(productId: string): Promise<import("@/core").ProductMetafield[]> {
      return genericRepo.getByEntityId(productId);
    },
  };
}
