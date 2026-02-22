import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";
import { toast } from "sonner";

export function useBulkDeleteTemplates(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateIds: string[]) => {
      // Delete all templates in parallel for better performance
      await Promise.all(
        templateIds.map((templateId) =>
          templateService.delete(templateId, orgId)
        )
      );
    },
    onSuccess: () => {
      // Invalidate templates query once after all deletions
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error: unknown, templateIds) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        `Failed to delete ${templateIds.length} template${templateIds.length > 1 ? "s" : ""}: ${message}`
      );
    },
  });
}
