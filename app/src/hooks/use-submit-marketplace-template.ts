import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

export function useSubmitMarketplaceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      sourceTemplateId: string;
      sourceTemplateType: "invoice" | "email";
      orgId: string;
      title: string;
    }) => {
      return functionsService.submitMarketplaceTemplate(payload);
    },
    onSuccess: (result, variables) => {
      // Invalidate queries to refresh submissions list
      // Invalidate all submission queries (with any organizationId)
      queryClient.invalidateQueries({ 
        queryKey: ["marketplaceTemplates", "submissions"],
        exact: false, // Match all queries starting with this key
      });
      // Also invalidate the specific organization's submissions query
      if (variables?.orgId) {
        queryClient.invalidateQueries({ 
          queryKey: ["marketplaceTemplates", "submissions", variables.orgId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });

      toast.success(result.message || "Template submitted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to submit template", {
        description: error.message,
      });
    },
  });
}
