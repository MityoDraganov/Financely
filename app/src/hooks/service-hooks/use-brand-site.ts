import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

/**
 * Hook to preview a previous version of a brand site
 */
export const usePreviewBrandSiteVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.previewBrandSiteVersion>[0]) =>
      functionsService.previewBrandSiteVersion(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      // Don't show toast here - the UI will handle opening the window
    },
    onError: (error: unknown) => {
      console.error("Failed to create preview:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create preview: ${errorMessage}`);
    },
  });
};

/**
 * Hook to generate a brand site using Firebase Functions.
 * Returns immediately with a task ID. Use useBrandSite to poll for status.
 */
export const useGenerateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.generateSite>[0]) => functionsService.generateSite(payload),
    onSuccess: (result) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSite", result.id],
      });
      
      toast.success("Site generation started! This may take a few minutes.", {
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      console.error("Failed to initiate site generation:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to start site generation: ${errorMessage}`);
    },
  });
};

/**
 * Hook to update analytics script in existing site without full regeneration.
 */
export const useUpdateAnalyticsScript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.updateAnalyticsScript>[0]) => 
      functionsService.updateAnalyticsScript(payload),
    onSuccess: (_result, variables) => {
      // Invalidate brand site queries to refresh
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      toast.success("Analytics script updated successfully");
    },
    onError: (error: unknown) => {
      console.error("Failed to update analytics script:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update analytics script: ${errorMessage}`);
    },
  });
};

/**
 * Hook to regenerate a brand site or section.
 * Returns immediately with a task ID. Use useBrandSite to poll for status.
 */
export const useRegenerateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.regenerateSite>[0]) => functionsService.regenerateSite(payload),
    onSuccess: (result) => {
      // Invalidate the specific brand site query (singular) to start polling
      queryClient.invalidateQueries({
        queryKey: ["brandSite", result.brandSiteId],
      });
      // Also invalidate brand sites list queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      
      toast.success("Site regeneration started! This may take a few minutes.", {
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      console.error("Failed to initiate site regeneration:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to start site regeneration: ${errorMessage}`);
    },
  });
};

/**
 * Hook to update brand site pages
 */
export const useUpdateBrandSitePages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.updateBrandSitePages>[0]) =>
      functionsService.updateBrandSitePages(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      toast.success("Page settings saved");
    },
    onError: (error: unknown) => {
      console.error("Failed to update brand site pages:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save pages: ${errorMessage}`);
    },
  });
};

/**
 * Hook to add a custom domain to a brand site
 */
export const useAddCustomDomain = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      brandSiteId: string;
      customDomain: string;
    }) => functionsService.addCustomDomain(payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brandSites", variables.brandSiteId],
      });
      // Show success message with additional info if DNS needs manual configuration
      if (result.dnsConfigured) {
        toast.success(`Custom domain ${result.customDomain} added successfully! DNS configured automatically.`);
      } else {
        toast.success(`Custom domain ${result.customDomain} added! Please configure DNS as shown.`);
      }
    },
    onError: (error: unknown) => {
      console.error("Failed to add custom domain:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to add custom domain: ${errorMessage}`);
    },
  });
};

/**
 * Hook to restore a previous version of a brand site
 */
export const useRestoreBrandSiteVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.restoreBrandSiteVersion>[0]) =>
      functionsService.restoreBrandSiteVersion(payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      toast.success(`Version ${result.restoredVersion} restored successfully!`);
    },
    onError: (error: unknown) => {
      console.error("Failed to restore version:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to restore version: ${errorMessage}`);
    },
  });
};

/**
 * Hook to manually deploy files to a brand site
 */
export const useDeployManualSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.deployManualSite>[0]) =>
      functionsService.deployManualSite(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      toast.success("Site deployed successfully!");
    },
    onError: (error: unknown) => {
      console.error("Failed to deploy site:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to deploy site: ${errorMessage}`);
    },
  });
};

