import { ProductMetafieldDefinition, ProductMetafieldDefinitionData, ProductMetafield, ProductMetafieldData } from "../../entities/product-metafield";
import { EntityMetafieldDefinitionRepository, EntityMetafieldRepository } from "./entity-metafield-repository";

export type ProductMetafieldDefinitionRepository =
  EntityMetafieldDefinitionRepository<ProductMetafieldDefinition, ProductMetafieldDefinitionData>;

export interface ProductMetafieldRepository extends EntityMetafieldRepository<ProductMetafield, ProductMetafieldData> {
  getByProductId(productId: string): Promise<ProductMetafield[]>;
}
