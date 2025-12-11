import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { functionsService } from "@/services/functions/functions-service";

type PeriodType = "current" | "previous" | "custom";

interface UseUsageHistoryOptions {
  periodType?: PeriodType;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook to fetch usage history for billing dashboard
 * 
 * @param organizationId - Organization ID
 * @param options - Period selection options
 * @param options.periodType - "current" (default), "previous", or "custom"
 * @param options.startDate - ISO date string for custom period start
 * @param options.endDate - ISO date string for custom period end
 */
export function useUsageHistory(
  organizationId: string | undefined,
  options: UseUsageHistoryOptions = {}
) {
  const { isAuthReady } = useAuthReady();
  const { periodType = "current", startDate, endDate } = options;

  // For custom period, both dates are required
  const isCustomPeriodValid = periodType !== "custom" || (!!startDate && !!endDate);

  return useQuery({
    queryKey: ["usageHistory", organizationId, periodType, startDate, endDate],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      return functionsService.getUsageHistory({
        organizationId,
        periodType,
        startDate,
        endDate,
      });
    },
    enabled: !!organizationId && isAuthReady && isCustomPeriodValid,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

