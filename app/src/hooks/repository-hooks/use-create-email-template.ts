import { EmailTemplateData } from "@/core";
import { emailTemplateService } from "@/services/email-template-service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateEmailTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EmailTemplateData) => emailTemplateService.create(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["email-templates", variables.orgId],
      });
    },
  });
};


