import {
  BusinessAnalyticsRecordsPayload,
  BusinessAnalyticsSummaryPayload,
} from "@/core/entities/business-analytics";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { serviceHost } from "@/services";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const functionsService = serviceHost.getFunctionsService();

export const useBusinessAnalyticsSummary = (
  payload: BusinessAnalyticsSummaryPayload | null,
) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["businessAnalytics", "summary", payload],
    queryFn: async () => {
      if (!payload) {
        throw new Error("Analytics summary payload is required");
      }
      return functionsService.getBusinessAnalyticsSummary(payload);
    },
    enabled: Boolean(payload?.orgId) && isAuthReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

export const useBusinessAnalyticsRecords = (
  payload: BusinessAnalyticsRecordsPayload | null,
) => {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["businessAnalytics", "records", payload],
    queryFn: async () => {
      if (!payload) {
        throw new Error("Analytics records payload is required");
      }
      return functionsService.getBusinessAnalyticsRecords(payload);
    },
    enabled: Boolean(payload?.orgId && payload?.tab) && isAuthReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};
