import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";
import { toast } from "sonner";

export function useDeleteTemplate(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await templateService.delete(templateId, orgId);
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
