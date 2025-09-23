import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { getProposalRepository } from "@/repositories";
import { CreateProposalParams, createProposalService } from "@/services/proposal-service";

const functionsService = serviceHost.getFunctionsService();
const proposalService = createProposalService(functionsService);
const databaseService = serviceHost.getDatabaseService();
const proposalRepository = getProposalRepository(databaseService);

export const useCreateProposal = () => {
  const queryClient = useQueryClient();
  
  return useMutation<string, Error, CreateProposalParams>({
    mutationKey: ["proposal", "create"],
    mutationFn: async (params: CreateProposalParams) => {
      return proposalService.createProposal(params);
    },
    onSuccess: () => {
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
