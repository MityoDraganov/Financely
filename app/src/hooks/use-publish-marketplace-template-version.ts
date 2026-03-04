import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

export function usePublishMarketplaceTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      marketplaceTemplateId: string;
      changelog?: string;
    }) => {
      return functionsService.publishMarketplaceTemplateVersion(payload);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", variables.marketplaceTemplateId] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplateVersions", variables.marketplaceTemplateId] });
      queryClient.invalidateQueries({
        queryKey: ["marketplaceTemplates", "submissions"],
        exact: false,
      });

      toast.success(result.message || `Version ${result.version} published successfully`);
    },
    onError: (error: Error) => {
      toast.error("Failed to publish new version", {
        description: error.message,
      });
    },
  });
}
