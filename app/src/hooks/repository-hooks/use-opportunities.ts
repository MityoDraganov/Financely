import { Opportunity, OpportunityData } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";

const databaseService = serviceHost.getDatabaseService();
const opportunityRepository = repositoryHost.getOpportunitiesRepository(databaseService);

export const useOpportunitiesByOrg = (orgId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["opportunities", "org", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return opportunityRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: orgId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!orgId && isAuthReady,
  });
};

export const useOpportunitiesByLead = (leadId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["opportunities", "lead", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      return opportunityRepository.getAll({
        queryConstraints: [
          { field: "leadId", operator: "==", value: leadId },
        ],
      });
    },
    enabled: !!leadId && isAuthReady,
  });
};

export const useOpportunity = (opportunityId: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["opportunities", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      return opportunityRepository.get({ id: opportunityId });
    },
    enabled: !!opportunityId && isAuthReady,
  });
};

export const useCreateOpportunity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OpportunityData) => {
      return opportunityRepository.create({ data });
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      if (data.organizationId) {
        queryClient.invalidateQueries({ queryKey: ["opportunities", "org", data.organizationId] });
      }
    },
  });
};

export const useUpdateOpportunity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OpportunityData> }) => {
      return opportunityRepository.update({ id, data });
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["opportunities"] });

      // Snapshot every opportunity list/detail in cache for rollback
      const previousEntries = queryClient.getQueriesData<Opportunity | Opportunity[]>({
        queryKey: ["opportunities"],
      });

      // Optimistically patch every cached list
      queryClient.setQueriesData<Opportunity[]>({ queryKey: ["opportunities"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((opp) => (opp.id === id ? { ...opp, ...data } : opp));
      });

      // Optimistically patch the single-item cache
      queryClient.setQueryData<Opportunity>(["opportunities", id], (old) =>
        old ? { ...old, ...data } : old
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, value] of context.previousEntries) {
          queryClient.setQueryData(queryKey, value);
        }
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
    },
  });
};

export const useDeleteOpportunity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return opportunityRepository.delete({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
};
