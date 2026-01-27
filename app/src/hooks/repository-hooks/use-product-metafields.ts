import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productMetafieldService } from "@/services/product-metafield-service";
import {
  CreateProductMetafieldDefinitionInput,
  UpdateProductMetafieldDefinitionInput,
  CreateProductMetafieldInput,
  UpdateProductMetafieldInput,
} from "@/core";

export function useProductMetafieldDefinitions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["productMetafieldDefinitions", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const result = await productMetafieldService.listProductMetafieldDefinitions(orgId);
      return result || [];
    },
    enabled: !!orgId,
  });
}

export function useProductMetafieldDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ["productMetafieldDefinition", id],
    queryFn: () => productMetafieldService.getProductMetafieldDefinition(id || ""),
    enabled: !!id,
  });
}

export function useCreateProductMetafieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductMetafieldDefinitionInput) =>
      productMetafieldService.createProductMetafieldDefinition(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productMetafieldDefinitions", variables.organizationId] });
    },
  });
}

export function useUpdateProductMetafieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductMetafieldDefinitionInput }) =>
      productMetafieldService.updateProductMetafieldDefinition(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["productMetafieldDefinition", id] });
      queryClient.invalidateQueries({ queryKey: ["productMetafieldDefinitions"] });
    },
  });
}

export function useDeleteProductMetafieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productMetafieldService.deleteProductMetafieldDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productMetafieldDefinitions"] });
    },
  });
}

export function useProductMetafields(orgId: string | undefined, productId?: string, definitionId?: string) {
  return useQuery({
    queryKey: ["productMetafields", orgId, productId, definitionId],
    queryFn: async () => {
      if (!orgId) return [];
      const result = await productMetafieldService.listProductMetafields(orgId, productId, definitionId);
      return result || [];
    },
    enabled: !!orgId,
  });
}

export function useProductMetafield(id: string | undefined) {
  return useQuery({
    queryKey: ["productMetafield", id],
    queryFn: () => productMetafieldService.getProductMetafield(id || ""),
    enabled: !!id,
  });
}

export function useCreateProductMetafield() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductMetafieldInput) =>
      productMetafieldService.createProductMetafield(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productMetafields", variables.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["productMetafields", variables.organizationId, variables.productId] });
    },
  });
}

export function useUpdateProductMetafield() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductMetafieldInput }) =>
      productMetafieldService.updateProductMetafield(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["productMetafield", id] });
      queryClient.invalidateQueries({ queryKey: ["productMetafields"] });
    },
  });
}

export function useDeleteProductMetafield() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productMetafieldService.deleteProductMetafield(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productMetafields"] });
    },
  });
}
