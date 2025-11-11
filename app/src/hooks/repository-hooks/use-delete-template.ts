import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import { toast } from "sonner";

const templateRepository = getTemplateRealtimeRepository();

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await templateRepository.delete({ id: templateId });
    },
    onSuccess: () => {
      // Invalidate templates query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted successfully");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete template: ${message}`);
    },
  });
}

