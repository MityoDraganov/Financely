import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MarketplaceTemplateData } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const marketplaceTemplateRepository =
  repositoryHost.getMarketplaceTemplateRepository(databaseService);

type UpdateMarketplaceTemplatePayload = {
  templateId: string;
  updates: Partial<MarketplaceTemplateData>;
};

export function useAdminUpdateMarketplaceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, updates }: UpdateMarketplaceTemplatePayload) => {
      await marketplaceTemplateRepository.update({
        id: templateId,
        data: updates,
      });
      return { templateId };
    },
    onSuccess: ({ templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", templateId] });
      toast.success("Template updated successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to update template: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });
}
