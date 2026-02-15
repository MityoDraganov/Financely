import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";
import { toast } from "sonner";

/**
 * Hook to fetch template versions
 */
export function useTemplateVersions(templateId: string | undefined) {
  return useQuery({
    queryKey: ["templateVersions", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      return templateService.listVersions(templateId);
    },
    enabled: !!templateId,
  });
}

/**
 * Hook to save a template version
 */
export function useSaveTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      userId,
      description,
    }: {
      templateId: string;
      userId?: string;
      description?: string;
      silent?: boolean;
    }) => {
      return templateService.saveVersion(templateId, userId, description);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["templateVersions", variables.templateId],
      });
      if (!variables.silent) {
        toast.success(`Version ${result.version} saved successfully`);
      }
    },
    onError: (error: unknown, variables) => {
      if (variables?.silent) return;
      const message = error instanceof Error ? error.message : "Failed to save version";
      toast.error(message);
    },
  });
}

/**
 * Hook to restore a template version
 */
export function useRestoreTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      version,
    }: {
      templateId: string;
      version: number;
    }) => {
      return templateService.restoreVersion(templateId, version);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["templateVersions", variables.templateId],
      });
      queryClient.invalidateQueries({
        queryKey: ["templates"],
      });
      toast.success(`Version ${variables.version} restored successfully`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to restore version";
      toast.error(message);
    },
  });
}
