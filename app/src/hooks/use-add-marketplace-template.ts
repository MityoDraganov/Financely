import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

export function useAddMarketplaceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { templateId: string; orgId: string }) => {
      return functionsService.addMarketplaceTemplate(payload);
    },
    onSuccess: (result, variables) => {
      // Invalidate marketplace queries
      queryClient.invalidateQueries({ queryKey: ["marketplace-templates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-template", variables.templateId] });
      
      // Invalidate organization templates
      queryClient.invalidateQueries({ queryKey: ["templates", "org", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["emailTemplates", "org", variables.orgId] });

      toast.success(result.message || "Template added successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to add template", {
        description: error.message,
      });
    },
  });
}
