import {
  ProductMetafieldDefinition,
  ProductMetafield,
  CreateProductMetafieldDefinitionInput,
  UpdateProductMetafieldDefinitionInput,
  CreateProductMetafieldInput,
  UpdateProductMetafieldInput,
} from "@/core";
import { getProductMetafieldDefinitionRepository, getProductMetafieldRepository } from "@/repositories/product-metafield-repository";
import { databaseService } from "./database/database-service";

const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);
const productMetafieldRepository = getProductMetafieldRepository(databaseService);

export type ProductMetafieldService = {
  // Product Metafield Definition operations
  createProductMetafieldDefinition: (data: CreateProductMetafieldDefinitionInput) => Promise<string>;
  getProductMetafieldDefinition: (id: string) => Promise<ProductMetafieldDefinition | null>;
  listProductMetafieldDefinitions: (orgId: string) => Promise<ProductMetafieldDefinition[]>;
  updateProductMetafieldDefinition: (id: string, data: UpdateProductMetafieldDefinitionInput) => Promise<void>;
  deleteProductMetafieldDefinition: (id: string) => Promise<void>;

  // Product Metafield operations
  createProductMetafield: (data: CreateProductMetafieldInput) => Promise<string>;
  getProductMetafield: (id: string) => Promise<ProductMetafield | null>;
  listProductMetafields: (orgId: string, productId?: string, definitionId?: string) => Promise<ProductMetafield[]>;
  updateProductMetafield: (id: string, data: UpdateProductMetafieldInput) => Promise<void>;
  deleteProductMetafield: (id: string) => Promise<void>;
};

export const productMetafieldService: ProductMetafieldService = {
  async createProductMetafieldDefinition(data) {
    const result = await productMetafieldDefinitionRepository.create({
      data,
    });
    return result;
  },

  async getProductMetafieldDefinition(id) {
    return productMetafieldDefinitionRepository.get({ id });
  },

  async listProductMetafieldDefinitions(orgId) {
    const result = await productMetafieldDefinitionRepository.getAll({
      queryConstraints: [{ field: "organizationId", operator: "==" as const, value: orgId }],
    });
    return result || [];
  },

  async updateProductMetafieldDefinition(id, data) {
    await productMetafieldDefinitionRepository.update({
      id,
      data,
    });
  },

  async deleteProductMetafieldDefinition(id) {
    await productMetafieldDefinitionRepository.delete({ id });
  },

  async createProductMetafield(data) {
    const result = await productMetafieldRepository.create({
      data,
    });
    return result;
  },

  async getProductMetafield(id) {
    return productMetafieldRepository.get({ id });
  },

  async listProductMetafields(orgId, productId, definitionId) {
    const constraints: import("@/core").QueryConstraint[] = [
      { field: "organizationId", operator: "==" as const, value: orgId }
    ];
    if (productId) {
      constraints.push({ field: "productId", operator: "==" as const, value: productId });
    }
    if (definitionId) {
      constraints.push({ field: "definitionId", operator: "==" as const, value: definitionId });
    }
    const result = await productMetafieldRepository.getAll({
      queryConstraints: constraints,
    });
    return result || [];
  },

  async updateProductMetafield(id, data) {
    await productMetafieldRepository.update({
      id,
      data,
    });
  },

  async deleteProductMetafield(id) {
    await productMetafieldRepository.delete({ id });
  },
};
