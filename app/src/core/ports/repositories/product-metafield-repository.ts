import { GenericRepository } from "./generic-repository";
import { ProductMetafieldDefinition, ProductMetafield } from "../../entities/product-metafield";

export interface ProductMetafieldDefinitionRepository extends GenericRepository<ProductMetafieldDefinition> {}

export interface ProductMetafieldRepository extends GenericRepository<ProductMetafield> {
  getByProductId(productId: string): Promise<ProductMetafield[]>;
  getByDefinitionId(definitionId: string): Promise<ProductMetafield[]>;
}
