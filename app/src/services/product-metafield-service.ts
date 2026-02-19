import {
  ProductMetafieldDefinition,
  ProductMetafieldDefinitionData,
  ProductMetafield,
  ProductMetafieldData,
  CreateProductMetafieldDefinitionInput,
  UpdateProductMetafieldDefinitionInput,
  CreateProductMetafieldInput,
  UpdateProductMetafieldInput,
} from "@/core";
import { getProductMetafieldDefinitionRepository, getProductMetafieldRepository } from "@/repositories/product-metafield-repository";
import { databaseService } from "./database/database-service";
import { createEntityMetafieldService } from "./entity-metafield-service-factory";

const productMetafieldDefinitionRepository = getProductMetafieldDefinitionRepository(databaseService);
const productMetafieldRepository = getProductMetafieldRepository(databaseService);
const baseEntityMetafieldService = createEntityMetafieldService<
  ProductMetafieldDefinition,
  ProductMetafieldDefinitionData,
  ProductMetafield,
  ProductMetafieldData
>({
  definitionRepository: productMetafieldDefinitionRepository,
  metafieldRepository: productMetafieldRepository,
  entityIdField: "productId",
});

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
    return baseEntityMetafieldService.createMetafieldDefinition(data);
  },

  async getProductMetafieldDefinition(id) {
    return baseEntityMetafieldService.getMetafieldDefinition(id);
  },

  async listProductMetafieldDefinitions(orgId) {
    return baseEntityMetafieldService.listMetafieldDefinitions(orgId);
  },

  async updateProductMetafieldDefinition(id, data) {
    await baseEntityMetafieldService.updateMetafieldDefinition(id, data);
  },

  async deleteProductMetafieldDefinition(id) {
    await baseEntityMetafieldService.deleteMetafieldDefinition(id);
  },

  async createProductMetafield(data) {
    return baseEntityMetafieldService.createMetafield(data);
  },

  async getProductMetafield(id) {
    return baseEntityMetafieldService.getMetafield(id);
  },

  async listProductMetafields(orgId, productId, definitionId) {
    return baseEntityMetafieldService.listMetafields(orgId, productId, definitionId);
  },

  async updateProductMetafield(id, data) {
    await baseEntityMetafieldService.updateMetafield(id, data);
  },

  async deleteProductMetafield(id) {
    await baseEntityMetafieldService.deleteMetafield(id);
  },
};
