import { OpportunityData } from "@/core";
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

export const useOpportunity = (id: string | undefined) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["opportunities", id],
    queryFn: async () => {
      if (!id) return null;
      return opportunityRepository.get({ id });
    },
    enabled: !!id && isAuthReady,
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
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!leadId && isAuthReady,
  });
};

export const useCreateOpportunity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OpportunityData) => {
      return opportunityRepository.create({ data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
};

export const useUpdateOpportunity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OpportunityData> }) => {
      return opportunityRepository.update({ id, data });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
    },
  });
};
