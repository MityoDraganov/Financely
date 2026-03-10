import { ReactNode } from "react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { OnboardingLanguageSelector } from "./steps/onboarding-language-selector";
import { OnboardingPreview } from "./onboarding-preview";
import { useOnboardingStore, STEPS } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";

// Steps that show the live workspace preview on the right
const STEPS_WITH_PREVIEW = [
  STEPS.CHOOSE_PATH,
  STEPS.BUSINESS_DETAILS,
  STEPS.BUSINESS_DESCRIPTION,
  STEPS.BRANDING,
  STEPS.TEMPLATE_SUGGESTIONS,
  STEPS.SUCCESS,
];

// Human-readable step names for progress indicator
const PROGRESS_STEPS = [
  { step: STEPS.WELCOME, label: "Welcome" },
  { step: STEPS.CHOOSE_PATH, label: "Path" },
  { step: STEPS.BUSINESS_DETAILS, label: "Details" },
  { step: STEPS.BUSINESS_DESCRIPTION, label: "About" },
  { step: STEPS.BRANDING, label: "Branding" },
  { step: STEPS.TEMPLATE_SUGGESTIONS, label: "Templates" },
  { step: STEPS.SIGN_UP, label: "Account" },
  { step: STEPS.PAYWALL, label: "Plan" },
  { step: STEPS.INVITE_MEMBERS, label: "Team" },
];

interface OnboardingShellProps {
  children: ReactNode;
}

export function OnboardingShell({ children }: OnboardingShellProps) {
  const { currentStep, brandingData } = useOnboardingStore(
    useShallow((state) => ({
      currentStep: state.currentStep,
      brandingData: state.brandingData,
    }))
  );

  const showPreview = STEPS_WITH_PREVIEW.includes(currentStep as typeof STEPS_WITH_PREVIEW[number]);

  return (
    <>
      {/* Fixed background layer — always covers the full viewport, never affects layout */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#166534] to-[#0e4424] pointer-events-none -z-10" />
      <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl -z-10" />
      <div className="pointer-events-none fixed -left-24 -bottom-24 h-96 w-96 rounded-full bg-white/5 blur-3xl -z-10" />

      {/* Scrollable content layer — min-h-screen so short steps fill viewport; grows so tall steps page-scroll */}
      <div className="min-h-screen w-full flex flex-col p-4 sm:p-6">

      {/* Main container */}
      <div className="relative flex flex-col w-full max-w-6xl mx-auto flex-1">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          {/* Progress indicator */}
          <div className="flex items-center gap-1.5">
            {PROGRESS_STEPS.map(({ step }) => (
              <div
                key={step}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: currentStep === step ? 24 : 8,
                  backgroundColor:
                    currentStep > step
                      ? brandingData.primaryColor
                      : currentStep === step
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
            <span className="text-white/50 text-xs ml-2">
              {Math.min(currentStep + 1, PROGRESS_STEPS.length)} of {PROGRESS_STEPS.length}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
            <OnboardingLanguageSelector />
            <ModeToggle />
          </div>
        </div>

        {/* Card — natural height; grid row stretches both columns to match the taller side */}
        <div className="rounded-3xl shadow-2xl overflow-hidden">
          <div className={`grid ${showPreview ? "lg:grid-cols-[1fr_400px]" : "grid-cols-1"}`}>

            {/* Left panel */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl lg:rounded-r-none">
              <div className="p-6 sm:p-8 flex flex-col">
                {children}
              </div>
            </div>

            {/* Right panel — live preview (desktop only); stretches to match left panel via grid */}
            {showPreview && (
              <div
                className="hidden lg:flex lg:flex-col rounded-r-3xl p-6"
                style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(8px)" }}
              >
                <OnboardingPreview />
              </div>
            )}
          </div>
        </div>

        {/* Mobile preview strip */}
        {showPreview && (
          <div className="lg:hidden mt-4 rounded-2xl p-4 bg-black/20 backdrop-blur-sm border border-white/10">
            <p className="text-white/50 text-[11px] uppercase tracking-wider mb-2">Your workspace</p>
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded shrink-0 transition-colors duration-300"
                style={{ backgroundColor: brandingData.primaryColor }}
              />
              <span className="text-white/80 text-sm font-medium truncate">
                {useOnboardingStore.getState().formData.name || "Your Company"}
              </span>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
