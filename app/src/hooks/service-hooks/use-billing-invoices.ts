import { useQuery } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { useAuthReady } from "@/hooks/use-auth-ready";

/**
 * Billing Invoice (Subscription Invoice)
 * 
 * These are invoices for the organization's subscription to Financely,
 * not customer invoices that the organization sends to their clients.
 */
export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "void";
  plan: string;
  pdfUrl?: string;
  stripeInvoiceId?: string; // When integrated with Stripe
}

interface GetBillingInvoicesResponse {
  invoices: BillingInvoice[];
}

/**
 * Hook to fetch billing invoices (subscription invoices)
 * 
 * Note: This will integrate with Stripe when Stripe Elements is implemented.
 * For now, returns empty array as placeholder.
 */
export function useBillingInvoices(organizationId: string | undefined) {
  const { isAuthReady } = useAuthReady();
  const functions = getFunctions(firebase.app);

  return useQuery<BillingInvoice[]>({
    queryKey: ["billingInvoices", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      // TODO: Replace with actual Cloud Function when Stripe is integrated
      // For now, return empty array as placeholder
      // const getBillingInvoicesFn = httpsCallable<
      //   { organizationId: string },
      //   GetBillingInvoicesResponse
      // >(functions, "getBillingInvoices");
      // const result = await getBillingInvoicesFn({ organizationId });
      // return result.data.invoices;

      return [];
    },
    enabled: !!organizationId && isAuthReady,
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
  });
}

/**
 * Hook to download a billing invoice PDF
 */
export function useDownloadBillingInvoice() {
  const functions = getFunctions(firebase.app);

  return async (invoiceId: string): Promise<string> => {
    // TODO: Replace with actual Cloud Function when Stripe is integrated
    // For now, throw error as placeholder
    // const downloadInvoiceFn = httpsCallable<{ invoiceId: string }, { url: string }>(
    //   functions,
    //   "downloadBillingInvoice"
    // );
    // const result = await downloadInvoiceFn({ invoiceId });
    // return result.data.url;

    throw new Error("Billing invoice download not yet implemented. Stripe integration pending.");
  };
}

