import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useCreateCheckoutSession } from "@/hooks/use-stripe-checkout";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ONBOARDING_CHECKOUT_FLAG = "financely_onboarding_checkout";

interface PaywallStepProps {
  onNext?: () => void;
  onSkip?: () => void;
}

const PLAN = {
  name: "Pro Plan",
  priceId: import.meta.env.VITE_STRIPE_PRICE_ID || "price_1SrZmZKFYBp87OV7EqNtL0T0",
  price: "€5",
  period: "month",
  trialDays: 14,
  features: [
    "Unlimited invoices",
    "Custom templates",
    "Email automation",
    "Analytics dashboard",
    "Priority support",
  ],
};

export function PaywallStep({ onNext: _onNext, onSkip }: PaywallStepProps) {
  const { t } = useTranslation();
  const { data: organization, isLoading: isOrgLoading } = useCurrentOrganization();
  const checkoutMutation = useCreateCheckoutSession();

  useEffect(() => {
    sessionStorage.setItem(ONBOARDING_CHECKOUT_FLAG, "true");
  }, []);

  const handleSubscribe = async () => {
    if (!organization?.id) {
      toast.error(t("onboarding.paywall.noOrganization", { defaultValue: "Organization not found. Please try again." }));
      return;
    }

    try {
      const result = await checkoutMutation.mutateAsync({
        orgId: organization.id,
        priceId: PLAN.priceId,
        successUrl: `${window.location.origin}/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/onboarding`,
      });

      window.location.href = result.url;
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(t("onboarding.paywall.checkoutFailed", { defaultValue: `Failed to start checkout: ${message}` }));
    }
  };

  const isLoading = isOrgLoading || checkoutMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground">
            {t("onboarding.paywall.title", { defaultValue: "Choose Your Plan" })}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground">
            {t("onboarding.paywall.description", {
              defaultValue: "Start your free trial and unlock all features",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">{PLAN.name}</CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {PLAN.price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{PLAN.period}
                    </span>
                  </div>
                  {PLAN.trialDays > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("onboarding.paywall.trialDays", {
                        defaultValue: `${PLAN.trialDays}-day free trial`,
                        days: PLAN.trialDays,
                      })}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {PLAN.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("onboarding.paywall.loading", { defaultValue: "Loading..." })}
                  </>
                ) : (
                  t("onboarding.paywall.startTrial", {
                    defaultValue: `Start ${PLAN.trialDays}-day free trial`,
                    days: PLAN.trialDays,
                  })
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t("onboarding.paywall.cancelAnytime", {
                  defaultValue: "Cancel anytime. No credit card required during trial.",
                })}
              </p>
            </CardContent>
          </Card>

          {onSkip && (
            <div className="text-center">
              <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
                {t("onboarding.paywall.skipForNow", { defaultValue: "Skip for now" })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
