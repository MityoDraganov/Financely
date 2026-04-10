import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { functionsService } from "@/services/functions/functions-service";

export function useConnectAccountStatus(organizationId: string | undefined) {
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["connectAccountStatus", organizationId],
    queryFn: () =>
      functionsService.getConnectAccountStatus({ orgId: organizationId! }),
    enabled: !!organizationId && isAuthReady,
    staleTime: 30 * 1000,
  });
}

export function useCreateConnectOnboardingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      payload: Parameters<typeof functionsService.createConnectOnboardingLink>[0]
    ) => functionsService.createConnectOnboardingLink(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({
        queryKey: ["connectAccountStatus", variables.orgId],
      });
    },
  });
}

export function useRetryInvoicePaymentSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      payload: Parameters<typeof functionsService.retryInvoicePaymentSync>[0]
    ) => functionsService.retryInvoicePaymentSync(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.invoiceId] });
    },
  });
}
