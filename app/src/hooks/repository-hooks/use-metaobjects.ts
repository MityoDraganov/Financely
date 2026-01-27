import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { metaobjectService } from "@/services/metaobject-service";
import {
  CreateMetaobjectDefinitionInput,
  UpdateMetaobjectDefinitionInput,
  CreateMetaobjectInput,
  UpdateMetaobjectInput,
} from "@/core";

export function useMetaobjectDefinitions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["metaobjectDefinitions", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const result = await metaobjectService.listMetaobjectDefinitions(orgId);
      return result || [];
    },
    enabled: !!orgId,
  });
}

export function useMetaobjectDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ["metaobjectDefinition", id],
    queryFn: () => metaobjectService.getMetaobjectDefinition(id || ""),
    enabled: !!id,
  });
}

export function useCreateMetaobjectDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMetaobjectDefinitionInput) =>
      metaobjectService.createMetaobjectDefinition(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["metaobjectDefinitions", variables.organizationId] });
    },
  });
}

export function useUpdateMetaobjectDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMetaobjectDefinitionInput }) =>
      metaobjectService.updateMetaobjectDefinition(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["metaobjectDefinition", id] });
      queryClient.invalidateQueries({ queryKey: ["metaobjectDefinitions"] });
    },
  });
}

export function useDeleteMetaobjectDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => metaobjectService.deleteMetaobjectDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metaobjectDefinitions"] });
    },
  });
}

export function useMetaobjects(orgId: string | undefined, definitionId?: string) {
  return useQuery({
    queryKey: ["metaobjects", orgId, definitionId],
    queryFn: async () => {
      if (!orgId) return [];
      const result = await metaobjectService.listMetaobjects(orgId, definitionId);
      return result || [];
    },
    enabled: !!orgId,
  });
}

export function useMetaobject(id: string | undefined) {
  return useQuery({
    queryKey: ["metaobject", id],
    queryFn: () => metaobjectService.getMetaobject(id || ""),
    enabled: !!id,
  });
}

export function useCreateMetaobject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMetaobjectInput) =>
      metaobjectService.createMetaobject(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["metaobjects", variables.organizationId] });
    },
  });
}

export function useUpdateMetaobject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMetaobjectInput }) =>
      metaobjectService.updateMetaobject(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["metaobject", id] });
      queryClient.invalidateQueries({ queryKey: ["metaobjects"] });
    },
  });
}

export function useDeleteMetaobject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => metaobjectService.deleteMetaobject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metaobjects"] });
    },
  });
}
