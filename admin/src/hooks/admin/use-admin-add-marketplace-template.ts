import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";

type AdminAddMarketplaceTemplatePayload = {
  templateId: string;
  orgId: string;
  templateType?: "invoice" | "email";
};

type AdminAddMarketplaceTemplateResult = {
  success: boolean;
  templateId: string;
  name: string;
  renamed: boolean;
  message: string;
};

export function useAdminAddMarketplaceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: AdminAddMarketplaceTemplatePayload,
    ): Promise<AdminAddMarketplaceTemplateResult> => {
      const callable = httpsCallable<
        AdminAddMarketplaceTemplatePayload,
        AdminAddMarketplaceTemplateResult
      >(getFunctions(firebase.app), "adminAddMarketplaceTemplate");

      const result = await callable(payload);
      return result.data;
    },
    onSuccess: async (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      await queryClient.invalidateQueries({ queryKey: ["templates", variables.orgId] });
      await queryClient.invalidateQueries({ queryKey: ["email-templates", variables.orgId] });
      await queryClient.invalidateQueries({ queryKey: ["templates", "org", variables.orgId] });
      await queryClient.invalidateQueries({ queryKey: ["emailTemplates", "org", variables.orgId] });

      if (variables.templateType === "invoice") {
        await queryClient.refetchQueries({ queryKey: ["templates", variables.orgId] });
      } else if (variables.templateType === "email") {
        await queryClient.refetchQueries({ queryKey: ["email-templates", variables.orgId] });
      } else {
        await queryClient.refetchQueries({ queryKey: ["templates", variables.orgId] });
        await queryClient.refetchQueries({ queryKey: ["email-templates", variables.orgId] });
      }
    },
  });
}

