import { GenericRepository } from "./generic-repository";
import { ProductMetafieldDefinition, ProductMetafieldDefinitionData, ProductMetafield, ProductMetafieldData } from "../../entities/product-metafield";

export interface ProductMetafieldDefinitionRepository extends GenericRepository<ProductMetafieldDefinition, ProductMetafieldDefinitionData> {}

export interface ProductMetafieldRepository extends GenericRepository<ProductMetafield, ProductMetafieldData> {
  getByProductId(productId: string): Promise<ProductMetafield[]>;
  getByDefinitionId(definitionId: string): Promise<ProductMetafield[]>;
}
