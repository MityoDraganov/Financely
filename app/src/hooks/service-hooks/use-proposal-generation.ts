import { useMutation } from "@tanstack/react-query";
import { ProposalData, normalizeProposalStatus } from "@/core";
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
        commercialCaseId:
          (result as { commercialCaseId?: string }).commercialCaseId ||
          "CASE_REQUIRED",
        status: normalizeProposalStatus(result.status),
        isIncomplete: ("isIncomplete" in result && typeof result.isIncomplete === "boolean") ? result.isIncomplete : false,
      };
    },
  });
};
