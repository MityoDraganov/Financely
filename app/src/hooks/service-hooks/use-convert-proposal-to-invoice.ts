/**
 * React Query hook for converting proposals to invoices using AI
 */

import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export function useConvertProposalToInvoice() {
  return useMutation({
    mutationFn: async (payload: {
      proposalId: string;
      templateId: string;
      organizationId: string;
    }) => {
      return functionsService.convertProposalToInvoice(payload);
    },
  });
}


