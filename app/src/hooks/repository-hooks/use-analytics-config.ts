import { AnalyticsConfigData } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const analyticsConfigRepository = repositoryHost.getAnalyticsConfigRepository(
  databaseService,
);

/**
 * Hook to fetch analytics config for an organization
 */
export const useAnalyticsConfig = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["analytics-config", orgId],
    queryFn: () => {
      if (!orgId) return Promise.resolve(null);
      return analyticsConfigRepository.get(orgId);
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to set analytics config for an organization
 */
export const useSetAnalyticsConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      data,
    }: {
      orgId: string;
      data: AnalyticsConfigData;
    }) => {
      return analyticsConfigRepository.set(orgId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-config", variables.orgId],
      });
    },
  });
};

/**
 * Hook to update analytics config for an organization
 */
export const useUpdateAnalyticsConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      data,
    }: {
      orgId: string;
      data: Partial<AnalyticsConfigData>;
    }) => {
      return analyticsConfigRepository.update(orgId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-config", variables.orgId],
      });
    },
  });
};

/**
 * Hook to delete analytics config for an organization
 */
export const useDeleteAnalyticsConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgId: string) => {
      return analyticsConfigRepository.delete(orgId);
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-config", orgId],
      });
    },
  });
};

