import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateData } from "@/core";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";

const templateRepository = getTemplateRealtimeRepository();

/**
 * Hook to create a new template
 */
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TemplateData) => {
      return templateRepository.create({ data });
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
