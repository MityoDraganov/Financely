import { ProductData, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const productRepository = repositoryHost.getProductsRepository(databaseService);

/**
 * Hook to fetch all products (optionally filtered by constraints)
 */
export const useProducts = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["products", "all", queryConstraints],
    queryFn: () => productRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch products by organization ID
 */
export const useProductsByOrg = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["products", "org", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: orgId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to fetch a single product by ID
 */
export const useProduct = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["products", productId],
    queryFn: async () => {
      if (!productId) return null;
      return productRepository.get({ id: productId });
    },
    enabled: !!productId,
  });
};

/**
 * Hook to update a product
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductData> }) => {
      return productRepository.update({ id, data });
    },
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", id] });
      
      if (data.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["products", "org", data.organizationId] 
        });
      }
    },
  });
};

/**
 * Hook to delete a product
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return productRepository.delete({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

