import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { toast } from "sonner";

/**
 * Hook to feature a marketplace template (admin only)
 */
export function useAdminFeatureMarketplaceTemplate() {
  const queryClient = useQueryClient();
  const functionsService = serviceHost.getFunctionsService();

  return useMutation({
    mutationFn: async (payload: { templateId: string }) => {
      return functionsService.featureMarketplaceTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", "all"] });
      toast.success("Template featured successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to feature template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
