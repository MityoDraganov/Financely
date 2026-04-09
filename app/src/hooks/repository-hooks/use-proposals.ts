import { ProposalData, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const proposalRepository = repositoryHost.getProposalsRepository(databaseService);

/**
 * Hook to fetch all proposals (optionally filtered by constraints)
 */
export const useProposals = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["proposals", "all", queryConstraints],
    queryFn: () => proposalRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch proposals by organization ID
 */
export const useProposalsByOrg = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["proposals", "org", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return proposalRepository.getAll({
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
 * Hook to fetch proposals by lead ID
 */
export const useProposalsByLead = (leadId: string | undefined) => {
  return useQuery({
    queryKey: ["proposals", "lead", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      return proposalRepository.getAll({
        queryConstraints: [
          { field: "leadId", operator: "==", value: leadId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!leadId,
  });
};

/**
 * Hook to fetch proposals by commercial case ID
 */
export const useProposalsByCommercialCase = (
  commercialCaseId: string | undefined,
) => {
  return useQuery({
    queryKey: ["proposals", "commercialCase", commercialCaseId],
    queryFn: async () => {
      if (!commercialCaseId) return [];
      return proposalRepository.getAll({
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
    enabled: !!commercialCaseId,
  });
};

// Temporary compatibility alias for legacy screens that still pass an opportunity ID.
export const useProposalsByOpportunity = (
  opportunityId: string | undefined,
) => useProposalsByCommercialCase(opportunityId);

/**
 * Hook to fetch a single proposal by ID
 */
export const useProposal = (proposalId: string | undefined) => {
  return useQuery({
    queryKey: ["proposals", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      return proposalRepository.get({ id: proposalId });
    },
    enabled: !!proposalId,
  });
};

/**
 * Hook to create a proposal
 */
export const useCreateProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProposalData) => proposalRepository.create({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["proposals", "org", variables.organizationId]
        });
      }
      if (variables.leadId) {
        queryClient.invalidateQueries({
          queryKey: ["proposals", "lead", variables.leadId]
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["proposals", "commercialCase", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
    },
  });
};

/**
 * Hook to update a proposal
 */
export const useUpdateProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProposalData> }) => {
      return proposalRepository.update({ id, data });
    },
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals", id] });
      
      if (data.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["proposals", "org", data.organizationId] 
        });
      }
      if (data.leadId) {
        queryClient.invalidateQueries({ 
          queryKey: ["proposals", "lead", data.leadId] 
        });
      }
    },
  });
};

/**
 * Hook to delete a proposal
 */
export const useDeleteProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return proposalRepository.delete({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
};
