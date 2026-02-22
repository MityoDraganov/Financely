import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateData } from "@/core";
import { templateService } from "@/services/template-service";

/**
 * Hook to create a new template
 */
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TemplateData) => {
      return templateService.createDraft(data);
    },
    onSuccess: (_, variables) => {
      // Invalidate templates queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates", variables.orgId] });
    },
    onError: (error: any) => {
      console.error("Failed to create template:", error);
    },
  });
};
