import { EmailTemplateData } from "@/core";
import { emailTemplateService } from "@/services/email-template-service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UpdatePayload = {
  id: string;
  data: Partial<EmailTemplateData>;
  orgId: string;
};

export const useUpdateEmailTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdatePayload) => emailTemplateService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["email-templates", variables.orgId],
      });
    },
  });
};


