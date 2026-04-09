import {
  CommercialCase,
  CommercialCaseData,
  CommercialCaseEventData,
  QueryConstraint,
} from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";

const databaseService = serviceHost.getDatabaseService();
const commercialCaseRepository =
  repositoryHost.getCommercialCasesRepository(databaseService);
const commercialCaseEventRepository =
  repositoryHost.getCommercialCaseEventsRepository(databaseService);

export const useCommercialCases = (queryConstraints?: QueryConstraint[]) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["commercialCases", "all", queryConstraints],
    queryFn: () =>
      commercialCaseRepository.getAll({
        queryConstraints: queryConstraints || [],
        orderBy: { field: "updatedAt", direction: "desc" },
      }),
    enabled: isAuthReady,
  });
};

export const useCommercialCasesByOrg = (organizationId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["commercialCases", "org", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      return commercialCaseRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organizationId },
        ],
        orderBy: { field: "updatedAt", direction: "desc" },
      });
    },
    enabled: !!organizationId && isAuthReady,
  });
};

export const useCommercialCase = (commercialCaseId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["commercialCases", commercialCaseId],
    queryFn: async () => {
      if (!commercialCaseId) return null;
      return commercialCaseRepository.get({ id: commercialCaseId });
    },
    enabled: !!commercialCaseId && isAuthReady,
  });
};

export const useCommercialCaseEvents = (commercialCaseId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["commercialCaseEvents", commercialCaseId],
    queryFn: async () => {
      if (!commercialCaseId) return [];
      return commercialCaseEventRepository.getAll({
        queryConstraints: [
          {
            field: "commercialCaseId",
            operator: "==",
            value: commercialCaseId,
          },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!commercialCaseId && isAuthReady,
  });
};

export const useCreateCommercialCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CommercialCaseData) =>
      commercialCaseRepository.create({ data }),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", "org", data.organizationId],
      });
    },
  });
};

export const useUpdateCommercialCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CommercialCaseData>;
    }) => commercialCaseRepository.update({ id, data }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["commercialCases"] });

      const previousEntries = queryClient.getQueriesData<
        CommercialCase | CommercialCase[]
      >({
        queryKey: ["commercialCases"],
      });

      queryClient.setQueriesData<CommercialCase[]>(
        { queryKey: ["commercialCases"] },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((item) => (item.id === id ? { ...item, ...data } : item));
        },
      );

      queryClient.setQueryData<CommercialCase>(["commercialCases", id], (old) =>
        old ? { ...old, ...data } : old,
      );

      return { previousEntries };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, value] of context.previousEntries) {
          queryClient.setQueryData(queryKey, value);
        }
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
      queryClient.invalidateQueries({ queryKey: ["commercialCases", id] });
      queryClient.invalidateQueries({ queryKey: ["commercialCaseEvents", id] });
    },
  });
};

export const useDeleteCommercialCase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => commercialCaseRepository.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
    },
  });
};

export const useAppendCommercialCaseEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CommercialCaseEventData) =>
      commercialCaseEventRepository.create({ data }),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", data.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", data.commercialCaseId],
      });
    },
  });
};
