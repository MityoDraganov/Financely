import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import {
  STEPS,
  useOnboardingStore,
} from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";
import { useCreateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useAuthReady } from "@/hooks/use-auth-ready";
import {
  WelcomeStep,
  ChoosePathStep,
  BrandingStep,
  JoinOrgStep,
  SignUpStep,
  PaywallStep,
  SuccessStep,
  BusinessDetailsStep,
  BusinessDescriptionStep,
  TemplateSuggestionsStep,
  InviteMembersStep,
} from "./steps";
import { OnboardingShell } from "./onboarding-shell";

export function PreSignupOnboardingFlow() {
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isAuthReady } = useAuthReady();
  const createOrganization = useCreateOrganization();
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState("");
  const hasAttemptedCreationRef = useRef(false);

  const {
    currentStep,
    formData,
    brandingData,
    businessData,
    selectedTemplates,
    inviteCode,
    setCurrentStep,
    setPath,
    setBrandingData,
    setInviteCode,
  } = useOnboardingStore(
    useShallow((state) => ({
      currentStep: state.currentStep,
      formData: state.formData,
      brandingData: state.brandingData,
      businessData: state.businessData,
      selectedTemplates: state.selectedTemplates,
      inviteCode: state.inviteCode,
      setCurrentStep: state.setCurrentStep,
      setPath: state.setPath,
      setBrandingData: state.setBrandingData,
      setInviteCode: state.setInviteCode,
    }))
  );

  // Create organization when user becomes authenticated on SIGN_UP step
  useEffect(() => {
    if (currentStep !== STEPS.SIGN_UP) {
      hasAttemptedCreationRef.current = false;
      return;
    }

    if (!isAuthLoaded || !isSignedIn) return;

    if (useOnboardingStore.getState().path !== "create") {
      setCurrentStep(STEPS.PAYWALL);
      return;
    }

    if (!formData.name.trim()) return;
    if (hasAttemptedCreationRef.current || isCreatingOrg) return;
    if (!isAuthReady) return;

    const createOrg = async () => {
      hasAttemptedCreationRef.current = true;
      setIsCreatingOrg(true);

      try {
        const orgData = {
          name: formData.name.trim(),
          ...(formData.website && { website: formData.website.trim() }),
          settings: {
            brandColors: {
              primary: brandingData.primaryColor || "#2563eb",
              secondary: brandingData.secondaryColor || "#6b7280",
              accent: brandingData.accentColor || "#10b981",
            },
            branding: {
              ...(businessData.logoUrl && { customLogo: businessData.logoUrl }),
              ...(businessData.businessDescription && { description: businessData.businessDescription }),
            },
            ...(businessData.country && { country: businessData.country }),
            ...(businessData.currency && { currency: businessData.currency }),
            ...(businessData.businessType && { businessType: businessData.businessType }),
            ...(selectedTemplates.length > 0 && { starterTemplates: selectedTemplates }),
          },
        };

        const organizationId = await createOrganization.mutateAsync(orgData);
        setCreatedOrgId(organizationId);
        toast.success("Organization created successfully!");
        setCurrentStep(STEPS.PAYWALL);
      } catch (error) {
        console.error("[PreSignupOnboardingFlow] Failed to create organization:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to create organization. Please try again.";
        toast.error(errorMessage);
        hasAttemptedCreationRef.current = false;
      } finally {
        setIsCreatingOrg(false);
      }
    };

    createOrg();
  }, [isAuthLoaded, isSignedIn, isAuthReady, currentStep, formData, brandingData, businessData, selectedTemplates, createOrganization, isCreatingOrg, setCurrentStep]);

  // Set startedAt on first mount
  useEffect(() => {
    const store = useOnboardingStore.getState();
    const hasData =
      store.currentStep > STEPS.WELCOME ||
      store.path !== null ||
      store.formData.name !== "" ||
      store.inviteCode !== "";
    if (hasData && !store.startedAt) {
      useOnboardingStore.setState({ startedAt: Date.now() });
    }
  }, []);

  const handleChooseCreate = () => {
    setPath("create");
    setCurrentStep(STEPS.BUSINESS_DETAILS);
  };

  const handleChooseJoin = () => {
    setPath("join");
    setCurrentStep(STEPS.JOIN_ORG);
  };

  const handleJoinOrganization = () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code.");
      return;
    }
    setInviteCode(inviteCode.trim().toUpperCase());
    setCurrentStep(STEPS.SIGN_UP);
  };

  const handlePaywallNext = () => {
    const path = useOnboardingStore.getState().path;
    setCurrentStep(path === "create" ? STEPS.INVITE_MEMBERS : STEPS.SUCCESS);
  };
  const handlePaywallSkip = () => {
    const path = useOnboardingStore.getState().path;
    setCurrentStep(path === "create" ? STEPS.INVITE_MEMBERS : STEPS.SUCCESS);
  };

  const handleComplete = () => {
    useOnboardingStore.getState().reset();
    navigate("/dashboard", { replace: true });
  };

  return (
    <OnboardingShell>
      <AnimatePresence mode="wait">
        {currentStep === STEPS.WELCOME && (
          <WelcomeStep
            key="welcome"
            userName=""
            onNext={() => setCurrentStep(STEPS.CHOOSE_PATH)}
          />
        )}

        {currentStep === STEPS.CHOOSE_PATH && (
          <ChoosePathStep
            key="choose"
            onCreate={handleChooseCreate}
            onJoin={handleChooseJoin}
          />
        )}

        {currentStep === STEPS.BUSINESS_DETAILS && (
          <BusinessDetailsStep
            key="business-details"
            onNext={() => setCurrentStep(STEPS.BUSINESS_DESCRIPTION)}
            onBack={() => setCurrentStep(STEPS.CHOOSE_PATH)}
          />
        )}

        {currentStep === STEPS.BUSINESS_DESCRIPTION && (
          <BusinessDescriptionStep
            key="business-description"
            onNext={() => setCurrentStep(STEPS.BRANDING)}
            onBack={() => setCurrentStep(STEPS.BUSINESS_DETAILS)}
          />
        )}

        {currentStep === STEPS.BRANDING && (
          <BrandingStep
            key="branding"
            brandingData={brandingData}
            setBrandingData={setBrandingData}
            setStoreBrandingData={setBrandingData}
            onBack={() => setCurrentStep(STEPS.BUSINESS_DESCRIPTION)}
            onSave={() => setCurrentStep(STEPS.TEMPLATE_SUGGESTIONS)}
            onSkip={() => setCurrentStep(STEPS.TEMPLATE_SUGGESTIONS)}
          />
        )}

        {currentStep === STEPS.TEMPLATE_SUGGESTIONS && (
          <TemplateSuggestionsStep
            key="templates"
            onNext={() => setCurrentStep(STEPS.SIGN_UP)}
            onBack={() => setCurrentStep(STEPS.BRANDING)}
          />
        )}

        {currentStep === STEPS.JOIN_ORG && (
          <JoinOrgStep
            key="join"
            inviteCode={inviteCode}
            setInviteCode={setInviteCode}
            setStoreInviteCode={setInviteCode}
            onBack={() => setCurrentStep(STEPS.CHOOSE_PATH)}
            onSubmit={handleJoinOrganization}
          />
        )}

        {currentStep === STEPS.SIGN_UP && (
          <SignUpStep
            key="signup"
            onBack={() => {
              const path = useOnboardingStore.getState().path;
              setCurrentStep(path === "join" ? STEPS.JOIN_ORG : STEPS.TEMPLATE_SUGGESTIONS);
            }}
          />
        )}

        {currentStep === STEPS.PAYWALL && (
          <PaywallStep key="paywall" onNext={handlePaywallNext} onSkip={handlePaywallSkip} />
        )}

        {currentStep === STEPS.INVITE_MEMBERS && (
          <InviteMembersStep
            key="invite-members"
            organizationId={createdOrgId}
            onNext={() => setCurrentStep(STEPS.SUCCESS)}
            onBack={() => setCurrentStep(STEPS.PAYWALL)}
          />
        )}

        {currentStep === STEPS.SUCCESS && (
          <SuccessStep key="success" orgName={formData.name} onComplete={handleComplete} />
        )}
      </AnimatePresence>
    </OnboardingShell>
  );
}
