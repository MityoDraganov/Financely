import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingFlow } from "@/components/onboarding";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { LoadingScreen } from "@/components/loading-screen";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { needsOnboarding, isLoading, organizations, completeOnboarding } = useOnboardingStatus();
  const hasRedirectedRef = useRef(false);

  // Redirect to dashboard if user has organizations (onboarding not needed)
  useEffect(() => {
    // Don't redirect if we've already redirected or are still loading
    if (hasRedirectedRef.current || isLoading) {
      return;
    }

    // If user has organizations, they don't need onboarding - redirect to dashboard
    if (organizations.length > 0) {
      hasRedirectedRef.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, organizations.length, navigate]);

  // Show loading while checking status
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Only show onboarding flow if user actually needs onboarding
  if (needsOnboarding) {
    const handleComplete = () => {
      completeOnboarding();
      navigate("/dashboard", { replace: true });
    };

    return (
      <div className="fixed inset-0 overflow-hidden">
        <OnboardingFlow onComplete={handleComplete} />
      </div>
    );
  }

  // If user doesn't need onboarding but has no organizations yet (edge case),
  // show loading while redirect happens
  return <LoadingScreen />;
}
