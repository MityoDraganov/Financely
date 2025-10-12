import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingFlow } from "@/components/onboarding";
import { useOnboardingStatus } from "@/hooks/use-onboarding";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { needsOnboarding, isLoading, completeOnboarding } = useOnboardingStatus();

  // If user doesn't need onboarding, redirect to dashboard
  useEffect(() => {
    if (!isLoading && !needsOnboarding) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, needsOnboarding, navigate]);

  // Show loading state while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#166534] mx-auto" />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // If user needs onboarding, show the onboarding flow
  if (needsOnboarding) {
    const handleComplete = () => {
      completeOnboarding();
      navigate("/dashboard", { replace: true });
    };

    return <OnboardingFlow onComplete={handleComplete} />;
  }

  // This should not be reached due to the useEffect redirect, but just in case
  return null;
}
