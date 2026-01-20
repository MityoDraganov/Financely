import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

interface AddMarketplaceTemplatePayload {
  templateId: string;
  orgId: string;
  templateType?: "invoice" | "email"; // Optional: helps optimize refetch
}

export function useAddMarketplaceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddMarketplaceTemplatePayload) => {
      return functionsService.addMarketplaceTemplate({
        templateId: payload.templateId,
        orgId: payload.orgId,
      });
    },
    onSuccess: async (result, variables) => {
      // Invalidate marketplace queries
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", variables.templateId] });
      
      // Invalidate organization templates
      await queryClient.invalidateQueries({ queryKey: ["templates", variables.orgId] });
      await queryClient.invalidateQueries({ queryKey: ["email-templates", variables.orgId] });
      
      // Also invalidate with "org" prefix for backwards compatibility
      await queryClient.invalidateQueries({ queryKey: ["templates", "org", variables.orgId] });
      await queryClient.invalidateQueries({ queryKey: ["emailTemplates", "org", variables.orgId] });

      // Explicitly refetch templates to ensure the new template appears immediately
      // Real-time subscriptions should pick this up, but refetch ensures immediate update
      // If templateType is provided, only refetch that type; otherwise refetch both
      if (variables.templateType === "invoice") {
        await queryClient.refetchQueries({ queryKey: ["templates", variables.orgId] });
      } else if (variables.templateType === "email") {
        await queryClient.refetchQueries({ queryKey: ["email-templates", variables.orgId] });
      } else {
        // Refetch both if type is unknown
        await queryClient.refetchQueries({ queryKey: ["templates", variables.orgId] });
        await queryClient.refetchQueries({ queryKey: ["email-templates", variables.orgId] });
      }

      toast.success(result.message || "Template added successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to add template", {
        description: error.message,
      });
    },
  });
}
