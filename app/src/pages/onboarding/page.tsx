import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingFlow } from "@/components/onboarding";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { LoadingScreen } from "@/components/loading-screen";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { needsOnboarding, isLoading, organizations, completeOnboarding } = useOnboardingStatus();
  const hasRedirectedRef = useRef(false);
  const onboardingInProgressRef = useRef(true);

  // Only redirect if we're certain the user has organizations and onboarding is complete
  useEffect(() => {
    // Don't redirect if we've already redirected, are still loading, or onboarding is in progress
    if (hasRedirectedRef.current || isLoading || onboardingInProgressRef.current) {
      return;
    }

    // Only redirect if user has organizations AND onboarding is not in progress
    // This means they definitely don't need onboarding and have completed it
    if (organizations.length > 0) {
      hasRedirectedRef.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, organizations.length, navigate]);

  // ALWAYS show loading while checking - this prevents any flash
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Only show onboarding flow if:
  // 1. They need onboarding (no organizations), OR
  // 2. They have organizations but onboarding is still in progress
  if (needsOnboarding || (organizations.length > 0 && onboardingInProgressRef.current)) {
    const handleComplete = () => {
      onboardingInProgressRef.current = false;
      completeOnboarding();
      navigate("/dashboard", { replace: true });
    };

    return (
      <div className="fixed inset-0 overflow-hidden">
        <OnboardingFlow onComplete={handleComplete} />
      </div>
    );
  }

  // Fallback: show loading if we're in an uncertain state
  return <LoadingScreen />;
}
