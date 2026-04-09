import { useMutation } from "@tanstack/react-query";
import { firebase } from "@/infrastructure/firebase";
import { httpsCallable } from "@firebase/functions";

interface ConvertLeadToOpportunityInput {
  leadId: string;
  organizationId: string;
  title: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string;
}

interface ConvertLeadToOpportunityOutput {
  opportunityId: string;
}

export const useConvertLeadToOpportunity = () => {
  return useMutation({
    mutationFn: async (input: ConvertLeadToOpportunityInput): Promise<ConvertLeadToOpportunityOutput> => {
      const fn = httpsCallable<ConvertLeadToOpportunityInput, ConvertLeadToOpportunityOutput>(
        firebase.functions,
        "convertLeadToOpportunity",
      );
      const result = await fn(input);
      return result.data;
    },
  });
};
