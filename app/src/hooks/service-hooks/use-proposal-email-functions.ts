import { useMutation } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

export const useSendProposalEmail = () => {
  return useMutation({
    mutationKey: ["proposals", "sendEmail"],
    mutationFn: functionsService.sendProposalEmail,
  });
};
