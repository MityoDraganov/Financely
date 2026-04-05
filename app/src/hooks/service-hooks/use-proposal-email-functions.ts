import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

export const useSendProposalEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["proposals", "sendEmail"],
    mutationFn: functionsService.sendProposalEmail,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      if (variables?.proposalId) {
        queryClient.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      }
    },
  });
};
