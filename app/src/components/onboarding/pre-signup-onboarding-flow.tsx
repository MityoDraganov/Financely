import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import {
  STEPS,
  useOnboardingStore
} from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";
import { useCreateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useAuthReady } from "@/hooks/use-auth-ready";
import {
  WelcomeStep,
  ChoosePathStep,
  BenefitsStep,
  CreateOrgStep,
  BrandingStep,
  InviteStep,
  JoinOrgStep,
  SignUpStep,
  SuccessStep,
  OnboardingLanguageSelector,
} from "./steps";
import { OnboardingButtons } from "./onboarding-buttons";

export function PreSignupOnboardingFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isAuthReady } = useAuthReady();
  const createOrganization = useCreateOrganization();
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const hasAttemptedCreationRef = useRef(false);
  
  // Use a single selector with shallow comparison to avoid infinite loops
  const {
    currentStep,
    formData,
    brandingData,
    inviteCode,
    setCurrentStep,
    setPath,
    setFormData,
    setBrandingData,
    setInviteCode,
  } = useOnboardingStore(
    useShallow((state) => ({
      currentStep: state.currentStep,
      formData: state.formData,
      brandingData: state.brandingData,
      inviteCode: state.inviteCode,
      setCurrentStep: state.setCurrentStep,
      setPath: state.setPath,
      setFormData: state.setFormData,
      setBrandingData: state.setBrandingData,
      setInviteCode: state.setInviteCode,
    }))
  );

  // Create organization when user becomes authenticated on SIGN_UP step
  useEffect(() => {
    // Reset ref when step changes away from SIGN_UP
    if (currentStep !== STEPS.SIGN_UP) {
      hasAttemptedCreationRef.current = false;
      return;
    }

    if (!isAuthLoaded || !isSignedIn || currentStep !== STEPS.SIGN_UP) {
      return;
    }

    // Only create organization for "create" path, not "join" path
    if (useOnboardingStore.getState().path !== "create") {
      // For join path, just go to success
      setCurrentStep(STEPS.SUCCESS);
      return;
    }

    // Check if we have form data
    if (!formData.name.trim()) {
      console.log("[PreSignupOnboardingFlow] No form data, skipping organization creation");
      return;
    }

    // Prevent multiple attempts
    if (hasAttemptedCreationRef.current || isCreatingOrg) {
      return;
    }

    // Wait for Firebase Auth to be ready before attempting creation
    if (!isAuthReady) {
      console.log("[PreSignupOnboardingFlow] Waiting for Firebase Auth to be ready...");
      return;
    }

    const createOrg = async () => {
      hasAttemptedCreationRef.current = true;
      setIsCreatingOrg(true);
      console.log("[PreSignupOnboardingFlow] Creating organization:", {
        name: formData.name,
        description: formData.description,
        website: formData.website,
        brandingData,
      });

      try {
        const orgData = {
          name: formData.name.trim(),
          ...(formData.description && { description: formData.description.trim() }),
          ...(formData.website && { website: formData.website.trim() }),
          settings: {
            brandColors: {
              primary: brandingData.primaryColor || "#2563eb",
              secondary: brandingData.secondaryColor || "#6b7280",
              accent: brandingData.accentColor || "#10b981",
            },
          },
        };

        await createOrganization.mutateAsync(orgData);
        
        console.log("[PreSignupOnboardingFlow] Organization created successfully, navigating to SUCCESS");
        toast.success(t("onboarding.messages.orgCreated", { defaultValue: "Organization created successfully!" }));

        // Navigate to SUCCESS step
        // Note: User and organization queries are invalidated by the mutation,
        // so they will refetch automatically when the dashboard loads
        setCurrentStep(STEPS.SUCCESS);
      } catch (error) {
        console.error("[PreSignupOnboardingFlow] Failed to create organization:", error);
        const errorMessage = error instanceof Error ? error.message : t("onboarding.messages.orgCreateFailed", { defaultValue: "Failed to create organization. Please try again." });
        toast.error(errorMessage);
        // Reset ref on error so user can retry
        hasAttemptedCreationRef.current = false;
      } finally {
        setIsCreatingOrg(false);
      }
    };

    createOrg();
  }, [isAuthLoaded, isSignedIn, isAuthReady, currentStep, formData, brandingData, createOrganization, isCreatingOrg, t, setCurrentStep]);

  // Initialize startedAt on first mount if not set
  useEffect(() => {
    const store = useOnboardingStore.getState();
    // Check if there's in-progress data without subscribing
    const hasData =
      store.currentStep > STEPS.WELCOME ||
      store.path !== null ||
      store.formData.name !== "" ||
      store.inviteCode !== "";
    
    if (hasData && !store.startedAt) {
      useOnboardingStore.setState({ startedAt: Date.now() });
    }
  }, []); // Only run once on mount

  const progress = ((currentStep + 1) / Object.keys(STEPS).length) * 100;

  const handleNext = () => {
    if (currentStep === STEPS.WELCOME) {
      setCurrentStep(STEPS.CHOOSE_PATH);
    } else if (currentStep < STEPS.SIGN_UP) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.JOIN_ORG) {
      setCurrentStep(STEPS.CHOOSE_PATH);
    } else if (currentStep > STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChooseCreate = () => {
    setPath("create");
    setCurrentStep(STEPS.BENEFITS);
  };

  const handleChooseJoin = () => {
    setPath("join");
    setCurrentStep(STEPS.JOIN_ORG);
  };

  const handleJoinOrganization = () => {
    if (!inviteCode.trim()) {
      toast.error(t("onboarding.messages.enterInviteCode"));
      return;
    }

    // Store invite code and mark as complete, then redirect to sign-up
    setInviteCode(inviteCode.trim().toUpperCase());
    setCurrentStep(STEPS.SUCCESS);
  };

  const handleCreateOrganization = () => {
    if (!formData.name.trim()) {
      toast.error(t("onboarding.messages.enterOrgName"));
      return;
    }

    // Just validate and move to branding step
    setCurrentStep(STEPS.BRANDING);
  };

  const handleComplete = () => {
    // Clear in-progress data from store
    useOnboardingStore.getState().reset();
    
    // Navigate to dashboard
    navigate("/dashboard", { replace: true });
  };

  const handleBrandingSave = () => {
    setCurrentStep(STEPS.INVITES);
  };

  const handleBrandingSkip = () => {
    setCurrentStep(STEPS.INVITES);
  };

  const handleInvitesSkip = () => {
    setCurrentStep(STEPS.SIGN_UP);
  };

  const handleInvitesContinue = () => {
    setCurrentStep(STEPS.SIGN_UP);
  };

  return (
    <div className="fixed inset-0 min-h-screen w-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex flex-col md:flex-row md:items-center md:justify-center overflow-y-auto overflow-x-hidden">
      {/* Language and Theme Selectors - Fixed in top-right corner */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2 md:top-4 md:right-4">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border/20 shadow-lg p-1.5 flex items-center gap-1.5">
          <OnboardingLanguageSelector />
          <ModeToggle />
        </div>
      </div>

      {/* Background decorations */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      {/* Sticky Header - Progress Bar (Mobile Only) */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-[#166534] to-[#0e4424] backdrop-blur-sm pt-4 px-4 pb-4 md:hidden">
        <div className="w-full max-w-4xl mx-auto">
          <Progress value={progress} className="h-2 bg-white/20 [&>div]:bg-white" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 w-full flex items-start md:items-center md:py-8 overflow-x-hidden">
        <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-6 pb-24 md:pb-6 overflow-x-hidden">
          {/* Progress bar for desktop */}
          <div className="hidden md:block mb-8">
            <Progress value={progress} className="h-2 bg-white/20" />
          </div>

          <AnimatePresence mode="wait">
            {currentStep === STEPS.WELCOME && (
              <WelcomeStep key="welcome" userName="" onNext={handleNext} />
            )}

            {currentStep === STEPS.CHOOSE_PATH && (
              <ChoosePathStep key="choose" onCreate={handleChooseCreate} onJoin={handleChooseJoin} />
            )}

            {currentStep === STEPS.BENEFITS && (
              <BenefitsStep key="benefits" onNext={handleNext} onBack={handleBack} />
            )}

            {currentStep === STEPS.CREATE_ORG && (
              <CreateOrgStep
                key="create"
                formData={formData}
                setFormData={setFormData}
                setStoreFormData={setFormData}
                onBack={handleBack}
                onSubmit={handleCreateOrganization}
              />
            )}

            {currentStep === STEPS.BRANDING && (
              <BrandingStep
                key="branding"
                brandingData={brandingData}
                setBrandingData={setBrandingData}
                setStoreBrandingData={setBrandingData}
                onSkip={handleBrandingSkip}
                onSave={handleBrandingSave}
              />
            )}

            {currentStep === STEPS.INVITES && (
              <InviteStep
                key="invites"
                onSkip={handleInvitesSkip}
                onContinue={handleInvitesContinue}
                onInvite={() => {}}
                onBack={handleBack}
                invites={[]}
                hasAdditionalUsers={false}
              />
            )}

            {currentStep === STEPS.JOIN_ORG && (
              <JoinOrgStep
                key="join"
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                setStoreInviteCode={setInviteCode}
                onBack={handleBack}
                onSubmit={handleJoinOrganization}
              />
            )}

            {currentStep === STEPS.SIGN_UP && (
              <SignUpStep key="signup" isCreating={isCreatingOrg} />
            )}

            {currentStep === STEPS.SUCCESS && (
              <SuccessStep key="success" orgName={formData.name} onComplete={handleComplete} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Footer - Buttons (Mobile Only) */}
      <div className="sticky bottom-0 z-20 bg-gradient-to-br from-[#166534] to-[#0e4424] backdrop-blur-sm pt-4 pb-4 px-4 border-t border-white/10 md:hidden shadow-lg">
        <div className="w-full max-w-4xl mx-auto">
          <OnboardingButtons
            currentStep={currentStep}
            formData={formData}
            inviteCode={inviteCode}
            onNext={handleNext}
            onBack={handleBack}
            onCreateOrganization={handleCreateOrganization}
            onJoinOrganization={handleJoinOrganization}
            onBrandingSkip={handleBrandingSkip}
            onBrandingSave={handleBrandingSave}
            onInvitesSkip={handleInvitesSkip}
            onInvitesContinue={handleInvitesContinue}
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );
}
