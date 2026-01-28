import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { toast } from "sonner";

export function useExternalSources() {
  const { data: organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: sourcesResult, isLoading, error } = useQuery({
    queryKey: ["externalSources", organization?.id],
    queryFn: () => {
      if (!organization?.id) return Promise.resolve({ sources: [] });
      return functionsService.listExternalSources({ organizationId: organization.id });
    },
    enabled: !!organization?.id,
  });

  const createSource = useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.createExternalSource>[0]) =>
      functionsService.createExternalSource(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["externalSources"] });
      toast.success("External source created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create external source", {
        description: error.message,
      });
    },
  });

  const updateSource = useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.updateExternalSource>[0]) =>
      functionsService.updateExternalSource(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["externalSources"] });
      toast.success("External source updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update external source", {
        description: error.message,
      });
    },
  });

  const deleteSource = useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.deleteExternalSource>[0]) =>
      functionsService.deleteExternalSource(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["externalSources"] });
      toast.success("External source deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete external source", {
        description: error.message,
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.testExternalSourceConnection>[0]) =>
      functionsService.testExternalSourceConnection(payload),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Connection test successful");
      } else {
        toast.error("Connection test failed", {
          description: result.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Connection test failed", {
        description: error.message,
      });
    },
  });

  const refreshSource = useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.refreshExternalSource>[0]) =>
      functionsService.refreshExternalSource(payload),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["externalSources"] });
        toast.success("Source refreshed successfully");
      } else {
        toast.error("Failed to refresh source", {
          description: result.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to refresh source", {
        description: error.message,
      });
    },
  });

  return {
    sources: sourcesResult?.sources || [],
    isLoading,
    error,
    createSource,
    updateSource,
    deleteSource,
    testConnection,
    refreshSource,
  };
}

