import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import { toast } from "sonner";

const templateRepository = getTemplateRealtimeRepository();

export function useBulkDeleteTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateIds: string[]) => {
      // Delete all templates in parallel for better performance
      await Promise.all(
        templateIds.map((templateId) =>
          templateRepository.delete({ id: templateId })
        )
      );
    },
    onSuccess: (_, templateIds) => {
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

