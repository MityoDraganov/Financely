import { serviceHost } from "@/services";
import { CreateProductMetafieldDefinitionInput } from "@/core";
import { createEntityMetafieldDefinitionFunctionHook } from "./entity-metafield-definition-function-hook";

const functionsService = serviceHost.getFunctionsService();

/**
 * Hook to create a product metafield definition via cloud function
 */
export const useCreateProductMetafieldDefinition =
  createEntityMetafieldDefinitionFunctionHook<CreateProductMetafieldDefinitionInput>({
    queryKeyRoot: "productMetafieldDefinitions",
    mutationFn: (payload) => functionsService.createProductMetafieldDefinition(payload),
  });
