import { useMutation } from "@tanstack/react-query";
import { ProposalData } from "@/core";
import { functionsService } from "@/services/functions/functions-service";

/**
 * Hook to generate a proposal suggestion from a lead using Firebase Functions
 */
export const useGenerateProposalSuggestion = () => {
  return useMutation({
    mutationFn: async ({ 
      leadId, 
      organizationId 
    }: { 
      leadId: string; 
      organizationId: string;
    }): Promise<ProposalData> => {
      return functionsService.generateProposalSuggestion({
        leadId,
        organizationId,
      });
    },
  });
};

