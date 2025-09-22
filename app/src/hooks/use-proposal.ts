import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { databaseService } from "@/infrastructure";
import { getProposalRepository } from "@/repositories";
import { CreateProposalParams, createProposalService } from "@/services/proposal-service";

const functionsService = serviceHost.getFunctionsService();
const proposalService = createProposalService(functionsService);
const proposalRepository = getProposalRepository(databaseService);

export const useCreateProposal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: CreateProposalParams) => proposalService.createProposal(params),
    onSuccess: () => {
      // Invalidate and refetch proposals
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
};

export const useGetProposal = (proposalId: string) => {
  return useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      return proposalRepository.get({ id: proposalId });
    },
    enabled: !!proposalId,
  });
};

export const useGetProposals = (orgId?: string) => {
  return useQuery({
    queryKey: ["proposals", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      return proposalRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!orgId,
  });
};
