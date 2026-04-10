import { AnalyticsViewData } from "@/core";
import { getAnalyticsViewRepository } from "@/repositories/analytics-view-repository";
import { serviceHost } from "@/services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";

const databaseService = serviceHost.getDatabaseService();
const analyticsViewRepository = getAnalyticsViewRepository(databaseService);

export const useAnalyticsViews = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ["analyticsViews", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      return analyticsViewRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organizationId },
        ],
        orderBy: { field: "updatedAt", direction: "desc" },
      });
    },
    enabled: !!organizationId,
  });
};

export const useCreateAnalyticsView = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async (payload: Omit<AnalyticsViewData, "organizationId" | "createdByUserId">) => {
      if (!organizationId) {
        throw new Error("Organization is required");
      }
      if (!user?.id) {
        throw new Error("User is required");
      }
      return analyticsViewRepository.create({
        data: {
          organizationId,
          createdByUserId: user.id,
          ...payload,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyticsViews", organizationId] });
    },
  });
};

export const useUpdateAnalyticsView = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AnalyticsViewData>;
    }) => analyticsViewRepository.update({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyticsViews", organizationId] });
    },
  });
};

export const useDeleteAnalyticsView = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => analyticsViewRepository.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyticsViews", organizationId] });
    },
  });
};
