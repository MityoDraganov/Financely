import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { CreateProductInput } from "@/core";

const functionsService = serviceHost.getFunctionsService();

/**
 * Hook to create a product via cloud function
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductInput) => {
      return functionsService.createProduct(payload);
    },
    onSuccess: (_, variables) => {
      // Invalidate products queries to refetch
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["products", "org", variables.organizationId] 
        });
      }
    },
  });
};

