import { CreateContactMetafieldDefinitionInput } from "@/core";
import { serviceHost } from "@/services";
import { createEntityMetafieldDefinitionFunctionHook } from "./entity-metafield-definition-function-hook";

const functionsService = serviceHost.getFunctionsService();

export const useCreateContactMetafieldDefinition =
  createEntityMetafieldDefinitionFunctionHook<CreateContactMetafieldDefinitionInput>({
    queryKeyRoot: "contactMetafieldDefinitions",
    mutationFn: (payload) => functionsService.createContactMetafieldDefinition(payload),
  });
