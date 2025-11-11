/**
 * React Query hook for generating invoice data from a proposal (without creating the invoice)
 */

import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export function useGenerateInvoiceFromProposal() {
  return useMutation({
    mutationFn: async (payload: {
      proposalId: string;
      templateId: string;
      organizationId: string;
    }) => {
      return functionsService.generateInvoiceFromProposal(payload);
    },
  });
}

