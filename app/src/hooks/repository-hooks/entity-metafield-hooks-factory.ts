import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type EntityMetafieldService<
  TDefinition,
  TMetafield,
  TCreateDefinitionInput extends { organizationId: string },
  TUpdateDefinitionInput,
  TCreateMetafieldInput extends { organizationId: string },
  TUpdateMetafieldInput,
> = {
  createMetafieldDefinition: (data: TCreateDefinitionInput) => Promise<string>;
  getMetafieldDefinition: (id: string) => Promise<TDefinition | null>;
  listMetafieldDefinitions: (orgId: string) => Promise<TDefinition[]>;
  updateMetafieldDefinition: (id: string, data: TUpdateDefinitionInput) => Promise<void>;
  deleteMetafieldDefinition: (id: string) => Promise<void>;

  createMetafield: (data: TCreateMetafieldInput) => Promise<string>;
  getMetafield: (id: string) => Promise<TMetafield | null>;
  listMetafields: (orgId: string, entityId?: string, definitionId?: string) => Promise<TMetafield[]>;
  updateMetafield: (id: string, data: TUpdateMetafieldInput) => Promise<void>;
  deleteMetafield: (id: string) => Promise<void>;
};

type EntityMetafieldHooksFactoryConfig<
  TDefinition,
  TMetafield,
  TCreateDefinitionInput extends { organizationId: string },
  TUpdateDefinitionInput,
  TCreateMetafieldInput extends { organizationId: string },
  TUpdateMetafieldInput,
> = {
  queryKeyPrefix: string;
  entityIdField: string;
  service: EntityMetafieldService<
    TDefinition,
    TMetafield,
    TCreateDefinitionInput,
    TUpdateDefinitionInput,
    TCreateMetafieldInput,
    TUpdateMetafieldInput
  >;
};

export function createEntityMetafieldHooks<
  TDefinition,
  TMetafield,
  TCreateDefinitionInput extends { organizationId: string },
  TUpdateDefinitionInput,
  TCreateMetafieldInput extends { organizationId: string },
  TUpdateMetafieldInput,
>({
  queryKeyPrefix,
  entityIdField,
  service,
}: EntityMetafieldHooksFactoryConfig<
  TDefinition,
  TMetafield,
  TCreateDefinitionInput,
  TUpdateDefinitionInput,
  TCreateMetafieldInput,
  TUpdateMetafieldInput
>) {
  const definitionRootKey = `${queryKeyPrefix}MetafieldDefinitions`;
  const definitionItemKey = `${queryKeyPrefix}MetafieldDefinition`;
  const metafieldRootKey = `${queryKeyPrefix}Metafields`;
  const metafieldItemKey = `${queryKeyPrefix}Metafield`;

  const useMetafieldDefinitions = (orgId: string | undefined) =>
    useQuery({
      queryKey: [definitionRootKey, orgId],
      queryFn: async () => {
        if (!orgId) return [];
        const result = await service.listMetafieldDefinitions(orgId);
        return result || [];
      },
      enabled: !!orgId,
    });

  const useMetafieldDefinition = (id: string | undefined) =>
    useQuery({
      queryKey: [definitionItemKey, id],
      queryFn: () => service.getMetafieldDefinition(id || ""),
      enabled: !!id,
    });

  const useCreateMetafieldDefinition = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: TCreateDefinitionInput) => service.createMetafieldDefinition(data),
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: [definitionRootKey, variables.organizationId] });
      },
    });
  };

  const useUpdateMetafieldDefinition = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdateDefinitionInput }) =>
        service.updateMetafieldDefinition(id, data),
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: [definitionItemKey, id] });
        queryClient.invalidateQueries({ queryKey: [definitionRootKey] });
      },
    });
  };

  const useDeleteMetafieldDefinition = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => service.deleteMetafieldDefinition(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [definitionRootKey] });
      },
    });
  };

  const useMetafields = (orgId: string | undefined, entityId?: string, definitionId?: string) =>
    useQuery({
      queryKey: [metafieldRootKey, orgId, entityId, definitionId],
      queryFn: async () => {
        if (!orgId) return [];
        const result = await service.listMetafields(orgId, entityId, definitionId);
        return result || [];
      },
      enabled: !!orgId,
    });

  const useMetafield = (id: string | undefined) =>
    useQuery({
      queryKey: [metafieldItemKey, id],
      queryFn: () => service.getMetafield(id || ""),
      enabled: !!id,
    });

  const useCreateMetafield = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: TCreateMetafieldInput) => service.createMetafield(data),
      onSuccess: (_, variables) => {
        const entityId = (variables as Record<string, unknown>)[entityIdField];
        queryClient.invalidateQueries({ queryKey: [metafieldRootKey, variables.organizationId] });
        if (typeof entityId === "string" && entityId) {
          queryClient.invalidateQueries({ queryKey: [metafieldRootKey, variables.organizationId, entityId] });
        }
      },
    });
  };

  const useUpdateMetafield = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdateMetafieldInput }) =>
        service.updateMetafield(id, data),
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: [metafieldItemKey, id] });
        queryClient.invalidateQueries({ queryKey: [metafieldRootKey] });
      },
    });
  };

  const useDeleteMetafield = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => service.deleteMetafield(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [metafieldRootKey] });
      },
    });
  };

  return {
    useMetafieldDefinitions,
    useMetafieldDefinition,
    useCreateMetafieldDefinition,
    useUpdateMetafieldDefinition,
    useDeleteMetafieldDefinition,
    useMetafields,
    useMetafield,
    useCreateMetafield,
    useUpdateMetafield,
    useDeleteMetafield,
  };
}
