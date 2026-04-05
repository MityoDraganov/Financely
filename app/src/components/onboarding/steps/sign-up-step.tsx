import { motion } from "framer-motion";
import { SignUp, useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Shield, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";

interface SignUpStepProps {
  onBack?: () => void;
}

export function SignUpStep({ onBack }: SignUpStepProps) {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const clerkShellRef = useRef<HTMLDivElement | null>(null);
  const { brandingData, formData } = useOnboardingStore(
    useShallow((state) => ({
      brandingData: state.brandingData,
      formData: state.formData,
    }))
  );

  const store = useOnboardingStore.getState();
  let afterSignUpUrl = "/onboarding";
  if (store.inviteCode) {
    afterSignUpUrl = `/onboarding?inviteCode=${store.inviteCode}`;
  }
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(afterSignUpUrl)}`;

  useEffect(() => {
    const root = clerkShellRef.current;
    if (!root) return;

    let frameId: number | null = null;
    const detectVerificationStep = () => {
      const hasOtpAutocomplete =
        root.querySelector("input[autocomplete='one-time-code']") !== null;
      const singleCharInputs = root.querySelectorAll("input[maxlength='1']").length;
      const hasVerificationLikeInput =
        root.querySelector("input[name*='code' i], input[id*='code' i]") !== null;
      const next = hasOtpAutocomplete || singleCharInputs >= 4 || hasVerificationLikeInput;
      setIsVerificationStep((prev) => (prev === next ? prev : next));
    };

    const scheduleDetect = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        detectVerificationStep();
      });
    };

    detectVerificationStep();
    const observer = new MutationObserver(scheduleDetect);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    window.addEventListener("focusin", scheduleDetect);

    return () => {
      observer.disconnect();
      window.removeEventListener("focusin", scheduleDetect);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isVerificationStep]);

  // Signed in — show loading state immediately; org creation is either imminent or in progress.
  // Never return null here: there is a brief window between Clerk completing and isCreating
  // being set by the parent effect, which would produce a blank screen.
  if (isAuthLoaded && isSignedIn) {
    return (
      <motion.div
        className="flex flex-col flex-1 justify-center items-center gap-6 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Setting up your workspace…
          </h2>
          <p className="text-muted-foreground text-base">
            Just a moment while we get everything ready.
          </p>
        </div>
      </motion.div>
    );
  }

  const orgName = formData.name.trim();

  if (isVerificationStep) {
    return (
      <div
        ref={clerkShellRef}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none p-4"
        style={{
          height: "100dvh",
          minHeight: "100dvh",
          paddingTop: "max(env(safe-area-inset-top), 1rem)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
        }}
      >
        <div className="w-full max-w-md">
          <SignUp
            afterSignUpUrl={afterSignUpUrl}
            signInUrl={signInUrl}
            routing="virtual"
            appearance={{
              variables: {
                colorPrimary: brandingData.primaryColor || "#166534",
                borderRadius: "0.75rem",
                fontFamily: "inherit",
                fontSize: "14px",
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-6 lg:flex-row lg:justify-between"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      {/* Header — same pattern as every other step */}
      <div>
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Last step</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Create your account
          </h2>
          <p className="text-muted-foreground text-base max-w-md">
            {orgName ? (
              <>
                Your <span className="font-medium text-foreground">{orgName}</span> workspace is
                ready — sign up to save it.
              </>
            ) : (
              "Your workspace is ready — sign up to save it and start sending invoices."
            )}
          </p>
        </div>
        {/* Workspace ready pill */}
        {orgName && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-xl bg-muted/60 border border-border"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: brandingData.primaryColor }}
            />
            <span className="text-sm font-medium text-foreground">{orgName}</span>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            <span className="text-xs text-muted-foreground">ready</span>
          </motion.div>
        )}
      </div>

    
      <div ref={clerkShellRef} className="w-full max-w-md">
        <SignUp
          afterSignUpUrl={afterSignUpUrl}
          signInUrl={signInUrl}
          routing="virtual"
          appearance={{
            variables: {
              colorPrimary: brandingData.primaryColor || "#166534",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
              fontSize: "14px",
            },
          }}
        />
      </div>
    </motion.div>
  );
}
