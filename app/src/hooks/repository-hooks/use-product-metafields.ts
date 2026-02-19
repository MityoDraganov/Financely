import {
  CreateProductMetafieldDefinitionInput,
  CreateProductMetafieldInput,
  ProductMetafield,
  ProductMetafieldDefinition,
  UpdateProductMetafieldDefinitionInput,
  UpdateProductMetafieldInput,
} from "@/core";
import { createEntityMetafieldHooks } from "./entity-metafield-hooks-factory";
import { productMetafieldService } from "@/services/product-metafield-service";

const productMetafieldHooks = createEntityMetafieldHooks<
  ProductMetafieldDefinition,
  ProductMetafield,
  CreateProductMetafieldDefinitionInput,
  UpdateProductMetafieldDefinitionInput,
  CreateProductMetafieldInput,
  UpdateProductMetafieldInput
>({
  queryKeyPrefix: "product",
  entityIdField: "productId",
  service: {
    createMetafieldDefinition: productMetafieldService.createProductMetafieldDefinition,
    getMetafieldDefinition: productMetafieldService.getProductMetafieldDefinition,
    listMetafieldDefinitions: productMetafieldService.listProductMetafieldDefinitions,
    updateMetafieldDefinition: productMetafieldService.updateProductMetafieldDefinition,
    deleteMetafieldDefinition: productMetafieldService.deleteProductMetafieldDefinition,
    createMetafield: productMetafieldService.createProductMetafield,
    getMetafield: productMetafieldService.getProductMetafield,
    listMetafields: productMetafieldService.listProductMetafields,
    updateMetafield: productMetafieldService.updateProductMetafield,
    deleteMetafield: productMetafieldService.deleteProductMetafield,
  },
});

export const useProductMetafieldDefinitions = productMetafieldHooks.useMetafieldDefinitions;
export const useProductMetafieldDefinition = productMetafieldHooks.useMetafieldDefinition;
export const useCreateProductMetafieldDefinition = productMetafieldHooks.useCreateMetafieldDefinition;
export const useUpdateProductMetafieldDefinition = productMetafieldHooks.useUpdateMetafieldDefinition;
export const useDeleteProductMetafieldDefinition = productMetafieldHooks.useDeleteMetafieldDefinition;
export const useProductMetafields = productMetafieldHooks.useMetafields;
export const useProductMetafield = productMetafieldHooks.useMetafield;
export const useCreateProductMetafield = productMetafieldHooks.useCreateMetafield;
export const useUpdateProductMetafield = productMetafieldHooks.useUpdateMetafield;
export const useDeleteProductMetafield = productMetafieldHooks.useDeleteMetafield;
