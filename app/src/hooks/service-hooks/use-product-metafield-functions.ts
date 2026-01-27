import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { CreateProductMetafieldDefinitionInput } from "@/core";

const functionsService = serviceHost.getFunctionsService();

/**
 * Hook to create a product metafield definition via cloud function
 */
export const useCreateProductMetafieldDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductMetafieldDefinitionInput) => {
      const result = await functionsService.createProductMetafieldDefinition(payload);
      return result.id;
    },
    onSuccess: (_, variables) => {
      // Invalidate product metafield definitions queries to refetch
      queryClient.invalidateQueries({ queryKey: ["productMetafieldDefinitions"] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["productMetafieldDefinitions", variables.organizationId] 
        });
      }
    },
  });
};
