import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { OnboardingFlow } from "@/components/onboarding";
import { PreSignupOnboardingFlow } from "@/components/onboarding/pre-signup-onboarding-flow";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { useHasInProgressData, useOnboardingStore, STEPS } from "@/hooks/use-onboarding-store";
import { LoadingScreen } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { ArrowRight, RotateCcw } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { needsOnboarding, isLoading, organizations, completeOnboarding } = useOnboardingStatus();
  const hasInProgressData = useHasInProgressData();
  const hasRedirectedRef = useRef(false);
  const [showResumeOption, setShowResumeOption] = useState(false);
  const { t } = useTranslation();

  // Check for resume option if not authenticated
  useEffect(() => {
    if (!isAuthLoaded || isSignedIn) {
      return;
    }

    // Check for in-progress data after a short delay to allow store hydration
    const timer = setTimeout(() => {
      // Check store directly to avoid dependency issues
      const store = useOnboardingStore.getState();
      const hasData =
        store.currentStep > STEPS.WELCOME ||
        store.path !== null ||
        store.formData.name !== "" ||
        store.inviteCode !== "";
      if (hasData) {
        setShowResumeOption(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthLoaded, isSignedIn]);

  // Redirect authenticated users with organizations to dashboard
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) {
      return;
    }

    // Don't redirect if we've already redirected or are still loading
    if (hasRedirectedRef.current || isLoading) {
      return;
    }

    // If user has organizations, they don't need onboarding - redirect to dashboard
    if (organizations.length > 0) {
      hasRedirectedRef.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthLoaded, isSignedIn, isLoading, organizations.length, navigate]);

  // Show loading while checking auth status
  if (!isAuthLoaded) {
    return <LoadingScreen />;
  }

  // Handle non-authenticated users (pre-signup quiz flow)
  if (!isSignedIn) {
    // Show resume option if there's in-progress data
    if (showResumeOption) {
      return (
        <div className="fixed inset-0 min-h-screen w-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex items-center justify-center p-4">
          <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl max-w-md w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-card-foreground">
                {t("onboarding.resume.title", { defaultValue: "Continue where you left off?" })}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("onboarding.resume.description", {
                  defaultValue: "We found your previous progress. Would you like to continue or start over?",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setShowResumeOption(false)}
                size="lg"
                className="w-full bg-[#166534] hover:bg-[#0e4424] text-white"
              >
                {t("onboarding.resume.continue", { defaultValue: "Continue" })}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={() => {
                  useOnboardingStore.getState().reset();
                  setShowResumeOption(false);
                }}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <RotateCcw className="mr-2 w-5 h-5" />
                {t("onboarding.resume.startOver", { defaultValue: "Start Over" })}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show pre-signup onboarding flow
    return <PreSignupOnboardingFlow />;
  }

  // Handle authenticated users (post-signup onboarding)
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
