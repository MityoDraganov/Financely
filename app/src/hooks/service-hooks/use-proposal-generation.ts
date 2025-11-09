import { useMutation } from "@tanstack/react-query";
import { ProposalData, PROPOSAL_STATUSES } from "@/core";
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
      const result = await functionsService.generateProposalSuggestion({
        leadId,
        organizationId,
      });
      // Ensure status is a valid ProposalStatus enum value
      return {
        ...result,
        status: (result.status === "DRAFT" || result.status === "SENT" || result.status === "ACCEPTED" || result.status === "REJECTED" || result.status === "EXPIRED")
          ? result.status as typeof PROPOSAL_STATUSES[keyof typeof PROPOSAL_STATUSES]
          : PROPOSAL_STATUSES.DRAFT,
      };
    },
  });
};

