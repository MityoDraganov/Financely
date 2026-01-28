import * as React from "react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const ONBOARDING_CHECKOUT_FLAG = "financely_onboarding_checkout";

/**
 * PaywallStep component displays Stripe Buy Button for plan selection.
 * 
 * IMPORTANT: Configure the return URL in your Stripe Dashboard Buy Button settings:
 * - Development: http://localhost:5173/stripe/checkout-success
 * - Production: https://yourdomain.com/stripe/checkout-success
 * 
 * This ensures users are redirected back to the app after completing checkout.
 */
export function PaywallStep() {
  const { t } = useTranslation();
  const stripeBuyButtonId = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID || "buy_btn_1Sue8uKFYBp87OV7QCe1Eu8W";
  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_51SZBnbKFYBp87OV78d3Tx9iHd9aLP3EHIX3eLwKfUcw27ESPpYQI7aStyShv9VyRukHaexLAgYLNc8D8KqEZORjd00ZLZ7kG3k";

  useEffect(() => {
    // Store flag to indicate user is checking out from onboarding
    sessionStorage.setItem(ONBOARDING_CHECKOUT_FLAG, "true");
    
    return () => {
      // Clean up flag if user navigates away without completing checkout
      // Note: This won't run if user is redirected to Stripe, which is what we want
    };
  }, []);

  useEffect(() => {
    if (document.querySelector('script[src="https://js.stripe.com/v3/buy-button.js"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/buy-button.js";
    script.async = true;
    script.onerror = () => {
      console.error("Failed to load Stripe Buy Button script");
    };
    document.body.appendChild(script);
  }, []);

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
              defaultValue: "Select the perfect plan to get started with Financely",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stripeBuyButtonId && stripePublishableKey ? (
            <div className="stripe-buy-button-wrapper">
              {React.createElement("stripe-buy-button", {
                "buy-button-id": stripeBuyButtonId,
                "publishable-key": stripePublishableKey,
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                {t("onboarding.paywall.noPlans", {
                  defaultValue: "Pricing plans will appear here once configured.",
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
