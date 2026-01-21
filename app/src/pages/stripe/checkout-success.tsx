import * as React from "react";
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { storePlanContext } from "@/utils/plan-context";

export default function CheckoutSuccessPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = React.useState(true);

  useEffect(() => {
    const planId = searchParams.get("plan_id") || searchParams.get("plan");
    const sessionId = searchParams.get("session_id");

    if (!planId) {
      // No plan ID, redirect to sign-up without plan context
      navigate("/sign-up", { replace: true });
      return;
    }

    // Store plan context
    storePlanContext(planId, "stripe");

    // Store session ID if available (for future reference)
    if (sessionId) {
      sessionStorage.setItem("financely_stripe_session_id", sessionId);
    }

    setIsProcessing(false);

    // Redirect to sign-up with plan context
    setTimeout(() => {
      navigate(`/sign-up?plan=${encodeURIComponent(planId)}&source=stripe`, {
        replace: true,
      });
    }, 1500);
  }, [searchParams, navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#166534] dark:text-[#22c55e] mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Processing your payment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Redirecting you to complete your account setup...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
