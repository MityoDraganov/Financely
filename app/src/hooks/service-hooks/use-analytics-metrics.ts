import { useQuery } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

/**
 * Hook to fetch analytics metrics for an organization
 */
export const useAnalyticsMetrics = (
  orgId: string | undefined,
  startDate?: string,
  endDate?: string,
) => {
  return useQuery({
    queryKey: ["analytics-metrics", orgId, startDate, endDate],
    queryFn: async () => {
      if (!orgId) {
        const defaultStart = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const defaultEnd = endDate || new Date().toISOString().split("T")[0];
        return {
          pageViews: 0,
          visitors: 0,
          bounceRate: 0,
          avgSessionDuration: 0,
          topPages: [],
          trafficSources: [],
          devices: [],
          browsers: [],
          referrers: [],
          pageViewsOverTime: [],
          dateRange: {
            start: defaultStart,
            end: defaultEnd,
          },
        };
      }
      return functionsService.getAnalyticsMetrics({
        orgId,
        startDate,
        endDate,
      });
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refetch every minute for real-time data
  });
};

