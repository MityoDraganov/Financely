import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
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
  const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const { isLoading, organizations } = useOnboardingStatus();
  const hasInProgressData = useHasInProgressData();
  const hasRedirectedRef = useRef(false);
  const [showResumeOption, setShowResumeOption] = useState(false);
  const { t } = useTranslation();

  // Log page load/redirect
  useEffect(() => {
    console.log("[OnboardingPage] Page loaded/redirected:", {
      userId,
      isSignedIn,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  }, [userId, isSignedIn]);

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

  // Debug: Log user state changes
  useEffect(() => {
    const store = useOnboardingStore.getState();
    const orgsData = organizations.map(org => ({ id: org.id, name: org.name }));
    console.log("[OnboardingPage] User state:", {
      isAuthLoaded,
      isSignedIn,
      isLoading,
      organizationsCount: organizations.length,
      organizations: orgsData,
      hasInProgressData,
      currentStep: store.currentStep,
      path: store.path,
      formDataName: store.formData.name,
      inviteCode: store.inviteCode,
      timestamp: new Date().toISOString(),
    });
  }, [isAuthLoaded, isSignedIn, isLoading, organizations, hasInProgressData]);

  // Redirect authenticated users with organizations to dashboard
  // BUT: Don't redirect if user has in-progress data (still completing onboarding flow)
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) {
      return;
    }

    // Don't redirect if we've already redirected or are still loading
    if (hasRedirectedRef.current || isLoading) {
      console.log("[OnboardingPage] Skipping redirect check:", {
        hasRedirected: hasRedirectedRef.current,
        isLoading,
      });
      return;
    }

    // Don't redirect if user has in-progress data - they're still completing onboarding
    if (hasInProgressData) {
      console.log("[OnboardingPage] User has in-progress data, continuing onboarding flow");
      return;
    }

    // If user has organizations, they don't need onboarding - redirect to dashboard
    if (organizations.length > 0) {
      console.log("[OnboardingPage] User has organizations, redirecting to dashboard:", {
        organizationsCount: organizations.length,
        organizationNames: organizations.map(org => org.name),
      });
      hasRedirectedRef.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthLoaded, isSignedIn, isLoading, organizations, hasInProgressData, navigate]);

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

  // Handle authenticated users - continue onboarding if they have in-progress data
  // The useEffect above handles redirecting to dashboard if they have organizations
  if (hasInProgressData) {
    console.log("[OnboardingPage] Rendering PreSignupOnboardingFlow for authenticated user with in-progress data");
    return <PreSignupOnboardingFlow />;
  }

  // If authenticated, no in-progress data, and no organizations, show loading
  // (The useEffect will handle redirecting to dashboard once organizations are loaded)
  console.log("[OnboardingPage] Showing loading screen - waiting for organizations to load");
  return <LoadingScreen />;
}
