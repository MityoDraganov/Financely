import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { functionsService } from "@/services/functions/functions-service";

/**
 * Fetches current subscription billing info from Stripe (period end, renewal, status).
 * Use this for billing UI so data comes from Stripe instead of Firestore.
 */
export function useStripeBilling(organizationId: string | undefined) {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["stripeBilling", organizationId],
    queryFn: () =>
      functionsService.getStripeBilling({ orgId: organizationId! }),
    enabled: !!organizationId && isAuthReady,
    staleTime: 60 * 1000,
  });
}
