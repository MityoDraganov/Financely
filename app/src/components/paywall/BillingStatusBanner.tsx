import { AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/use-billing";
import { useCreatePortalSession, useCreateCheckoutSession } from "@/hooks/use-stripe-checkout";
import { PLAN } from "@/lib/billing/plan";
import { toast } from "sonner";

/**
 * Persistent banner shown at the top of AppLayout when billing needs attention.
 * Returns null for active/trialing orgs — renders nothing during normal operation.
 */
export function BillingStatusBanner() {
  const { status, organizationId, isLoading, needsAttention, isCanceled, isPaused, isIncomplete } = useBilling();
  const portalMutation = useCreatePortalSession();
  const checkoutMutation = useCreateCheckoutSession();

  // Don't flash on first load or when billing is fine
  if (isLoading || !needsAttention && !isPaused && !isIncomplete) return null;
  if (!status) return null;

  const handlePortal = async () => {
    if (!organizationId) return;
    try {
      const result = await portalMutation.mutateAsync({
        orgId: organizationId,
        returnUrl: window.location.href,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to open billing portal: ${message}`);
    }
  };

  const handleReactivate = async () => {
    if (!organizationId) return;
    try {
      const result = await checkoutMutation.mutateAsync({
        orgId: organizationId,
        priceId: PLAN.priceId,
        successUrl: `${window.location.origin}/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to start checkout: ${message}`);
    }
  };

  const isMutating = portalMutation.isPending || checkoutMutation.isPending;

  type BannerConfig = {
    variant: "amber" | "red";
    message: string;
    action: { label: string; onClick: () => void } | { label: string; href: string };
  };

  const config: BannerConfig | null = (() => {
    switch (status) {
      case "past_due":
        return {
          variant: "amber",
          message: "Your payment is past due. Write access is suspended until resolved.",
          action: { label: "Manage billing", onClick: handlePortal },
        };
      case "unpaid":
        return {
          variant: "red",
          message: "Payment failed. Update your payment method to restore access.",
          action: { label: "Manage billing", onClick: handlePortal },
        };
      case "canceled":
        return {
          variant: "red",
          message: "Your subscription has ended. Reactivate to unlock all features.",
          action: { label: "Reactivate", onClick: handleReactivate },
        };
      case "paused":
        return {
          variant: "amber",
          message: "Your subscription is paused.",
          action: { label: "Manage billing", onClick: handlePortal },
        };
      case "incomplete":
        return {
          variant: "amber",
          message: "Your subscription setup is incomplete.",
          action: { label: "Complete setup", href: "/settings/organization/billing" },
        };
      default:
        return null;
    }
  })();

  if (!config) return null;

  const isAmber = config.variant === "amber";
  const Icon = isAmber ? AlertTriangle : XCircle;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
        isAmber
          ? "bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800"
          : "bg-red-50 text-red-900 border-b border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{config.message}</span>
      </div>

      {"href" in config.action ? (
        <Link
          to={config.action.href}
          className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          {config.action.label}
        </Link>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={`shrink-0 h-7 px-2 font-medium ${
            isAmber
              ? "text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
              : "text-red-900 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/40"
          }`}
          onClick={config.action.onClick}
          disabled={isMutating}
        >
          {isMutating && isCanceled ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          {config.action.label} →
        </Button>
      )}
    </div>
  );
}
