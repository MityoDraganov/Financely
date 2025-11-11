/**
 * React Query hooks for widget versioning
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

/**
 * Hook to restore a previous version of widget configuration
 */
export const useRestoreWidgetVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.restoreWidgetVersion>[0]) =>
      functionsService.restoreWidgetVersion(payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organization", variables.organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["organizations"],
      });
      toast.success(`Widget version ${result.restoredVersion} restored successfully!`);
    },
    onError: (error: unknown) => {
      console.error("Failed to restore widget version:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to restore version: ${errorMessage}`);
    },
  });
};

/**
 * Hook to save current widget configuration as a new version
 */
export const useSaveWidgetVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.saveWidgetVersion>[0]) =>
      functionsService.saveWidgetVersion(payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organization", variables.organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["organizations"],
      });
      toast.success(`Widget configuration saved as version ${result.version}!`);
    },
    onError: (error: unknown) => {
      console.error("Failed to save widget version:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save version: ${errorMessage}`);
    },
  });
};


