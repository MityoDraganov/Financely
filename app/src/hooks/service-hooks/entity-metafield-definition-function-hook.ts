import { useMutation, useQueryClient } from "@tanstack/react-query";

type MutationFn<TPayload extends { organizationId: string }> = (payload: TPayload) => Promise<{ id: string } | string>;

type CreateEntityMetafieldDefinitionHookConfig<TPayload extends { organizationId: string }> = {
  queryKeyRoot: string;
  mutationFn: MutationFn<TPayload>;
};

export const createEntityMetafieldDefinitionFunctionHook = <
  TPayload extends { organizationId: string },
>({
  queryKeyRoot,
  mutationFn,
}: CreateEntityMetafieldDefinitionHookConfig<TPayload>) => {
  return () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (payload: TPayload) => {
        const result = await mutationFn(payload);
        if (typeof result === "string") {
          return result;
        }
        return result.id;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: [queryKeyRoot] });
        if (variables.organizationId) {
          queryClient.invalidateQueries({
            queryKey: [queryKeyRoot, variables.organizationId],
          });
        }
      },
    });
  };
};
