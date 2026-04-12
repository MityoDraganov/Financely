import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBilling } from "@/hooks/use-billing";
import { useCreateCheckoutSession } from "@/hooks/use-stripe-checkout";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/billing/feature-registry";
import { PLAN } from "@/lib/billing/plan";
import { PaywallPreviewPanel } from "./preview/PaywallPreviewPanel";
import { toast } from "sonner";

interface PaywallModalProps {
  isOpen: boolean;
  featureKey: FeatureKey | null;
  onClose: () => void;
}

export function PaywallModal({ isOpen, featureKey, onClose }: PaywallModalProps) {
  const { organizationId } = useBilling();
  const checkoutMutation = useCreateCheckoutSession();

  const feature = featureKey ? FEATURE_REGISTRY[featureKey] : null;

  const handleSubscribe = async () => {
    if (!organizationId) {
      toast.error("Organization not found. Please try again.");
      return;
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/*
       * Override the default single-column DialogContent:
       * – Wider to accommodate the two-panel layout
       * – p-0 / gap-0 so the panels own their own spacing
       * – overflow-hidden for the dark right panel's rounded corners
       */}
      <DialogContent
        className="sm:max-w-[780px] p-0 gap-0 overflow-hidden"
        showCloseButton
      >
        <div className="flex min-h-0">

          {/* ── LEFT: subscription details ──────────────────────────────── */}
          <div className="flex flex-col gap-0 w-full sm:w-[320px] flex-shrink-0 p-6">

            {/* badge */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Pro
              </span>
            </div>

            {/* headline + description */}
            <DialogHeader className="space-y-1.5 text-left mb-5">
              <DialogTitle className="text-[19px] font-semibold tracking-tight leading-snug">
                {feature?.contextualHeadline ?? "Upgrade to Pro"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground leading-relaxed">
                Everything you need to run your business — in one place.
              </DialogDescription>
            </DialogHeader>

            {/* benefit bullets */}
            {feature?.benefits && (
              <ul className="space-y-2.5 mb-5">
                {feature.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground leading-snug">{benefit}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* push the pricing block to the bottom */}
            <div className="flex-1" />

            {/* pricing block */}
            <div className="border-t border-border pt-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{PLAN.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {PLAN.trialDays}-day free trial, then {PLAN.price}/{PLAN.period}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[22px] font-extrabold text-foreground">{PLAN.price}</span>
                  <span className="text-[12px] text-muted-foreground">/{PLAN.period}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubscribe}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Start ${PLAN.trialDays}-day free trial`
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                No credit card required · Cancel anytime
              </p>
            </div>
          </div>

          {/* ── RIGHT: animated preview (hidden on mobile) ──────────────── */}
          <div
            className="hidden sm:block flex-1 relative overflow-hidden"
            style={{ minHeight: "460px" }}
          >
            <PaywallPreviewPanel featureKey={featureKey} />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
