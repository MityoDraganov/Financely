import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

/**
 * Hook to create a Stripe Checkout session.
 * Returns a mutation that creates a checkout session and returns the URL to redirect to.
 */
export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.createCheckoutSession>[0]) =>
      functionsService.createCheckoutSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["stripeBilling"] });
    },
  });
}

/**
 * Hook to create a Stripe Customer Portal session.
 * Returns a mutation that creates a portal session and returns the URL to redirect to.
 */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.createPortalSession>[0]) =>
      functionsService.createPortalSession(payload),
  });
}
