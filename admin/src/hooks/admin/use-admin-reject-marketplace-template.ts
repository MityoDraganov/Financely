import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { toast } from "sonner";

/**
 * Hook to unfeature a marketplace template (admin only)
 */
export function useAdminUnfeatureMarketplaceTemplate() {
  const queryClient = useQueryClient();
  const functionsService = serviceHost.getFunctionsService();

  return useMutation({
    mutationFn: async (payload: { templateId: string }) => {
      return functionsService.unfeatureMarketplaceTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", "all"] });
      toast.success("Template unfeatured successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to unfeature template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
