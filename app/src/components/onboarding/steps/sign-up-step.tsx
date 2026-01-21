import { motion } from "framer-motion";
import { SignUp, useAuth } from "@clerk/clerk-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

interface SignUpStepProps {
  isCreating?: boolean;
}

export function SignUpStep({ isCreating = false }: SignUpStepProps) {
  const { t } = useTranslation();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const store = useOnboardingStore.getState();

  // Determine redirect URL after sign-up
  // After sign-up, user will be redirected back to /onboarding
  let afterSignUpUrl = "/onboarding";
  if (store.inviteCode) {
    afterSignUpUrl = `/onboarding?inviteCode=${store.inviteCode}`;
  }

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(afterSignUpUrl)}`;

  console.log("[SignUpStep] Sign-up configuration:", {
    afterSignUpUrl,
    signInUrl,
    inviteCode: store.inviteCode,
    currentStep: store.currentStep,
    path: store.path,
    formDataName: store.formData.name,
    isSignedIn,
    isAuthLoaded,
    timestamp: new Date().toISOString(),
  });

  // Show loading state when creating organization
  if (isAuthLoaded && isSignedIn && isCreating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-card-foreground mb-2 break-words px-2">
              {t("onboarding.signUp.creatingOrg", { defaultValue: "Creating your workspace..." })}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground break-words px-2">
              {t("onboarding.signUp.creatingOrgDesc", { 
                defaultValue: "Please wait while we set everything up for you." 
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </motion.div>
    );
  }

  // Don't render SignUp component if user is already signed in (organization creation in progress)
  // This prevents Clerk from redirecting and causing a loop
  if (isAuthLoaded && isSignedIn) {
    console.log("[SignUpStep] User already signed in, waiting for organization creation");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-card-foreground mb-2 break-words px-2">
            {t("onboarding.signUp.title", { defaultValue: "Almost there! 🎉" })}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground break-words px-2">
            {t("onboarding.signUp.description", { 
              defaultValue: "One final step to unlock your workspace and start automating your finances." 
            })}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Clerk SignUp Component - No Card Wrapper */}
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <SignUp 
            afterSignUpUrl={afterSignUpUrl}
            signInUrl={signInUrl}
            routing="virtual"
            appearance={{
              elements: {
                rootBox: "mx-auto",
              }
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
