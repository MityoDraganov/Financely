import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingFlow } from "@/components/onboarding";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { LoadingScreen } from "@/components/loading-screen";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { needsOnboarding, isLoading, organizations, completeOnboarding } = useOnboardingStatus();
  const hasRedirectedRef = useRef(false);

  // Only redirect if we're certain the user has organizations and doesn't need onboarding
  useEffect(() => {
    // Don't redirect if we've already redirected or are still loading
    if (hasRedirectedRef.current || isLoading) {
      return;
    }

    // Only redirect if user has organizations (confirmed they don't need onboarding)
    // This means they definitely don't need onboarding
    if (organizations.length > 0) {
      hasRedirectedRef.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, organizations.length, navigate]);

  // ALWAYS show loading while checking - this prevents any flash
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If user has organizations, show loading (redirect will happen)
  // This prevents the onboarding flow from flashing
  if (organizations.length > 0) {
    return <LoadingScreen />;
  }

  // Only show onboarding flow if we're certain they need it
  // (no organizations and not loading)
  if (needsOnboarding) {
    const handleComplete = () => {
      completeOnboarding();
      navigate("/dashboard", { replace: true });
    };

    return <OnboardingFlow onComplete={handleComplete} />;
  }

  // Fallback: show loading if we're in an uncertain state
  return <LoadingScreen />;
}
