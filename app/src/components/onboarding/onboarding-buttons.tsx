import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type React from "react";
import { STEPS } from "@/hooks/use-onboarding-store";

interface OnboardingButtonsProps {
  currentStep: number;
  formData: { name: string; description: string; website: string };
  inviteCode: string;
  onNext: () => void;
  onBack: () => void;
  onCreateOrganization: () => void;
  onJoinOrganization: () => void;
  onBrandingSkip: () => void;
  onBrandingSave: () => void;
  onInvitesSkip: () => void;
  onInvitesContinue: () => void;
  onPaywallSkip?: () => void;
  onComplete?: () => void;
}

export function OnboardingButtons({
  currentStep,
  formData,
  inviteCode,
  onNext,
  onBack,
  onCreateOrganization,
  onJoinOrganization,
  onBrandingSkip,
  onBrandingSave,
  onInvitesSkip,
  onInvitesContinue,
  onPaywallSkip,
  onComplete,
}: OnboardingButtonsProps) {
  const { t } = useTranslation();

  // Shared button styles
  const primaryButtonClass = "bg-card text-primary hover:bg-accent md:bg-primary md:hover:bg-primary/90 md:text-primary-foreground px-8 rounded-xl w-full sm:w-auto";
  const outlineButtonClass = "rounded-xl w-full sm:w-auto bg-card border-border text-foreground hover:bg-accent md:bg-transparent";

  type ButtonConfig = {
    left?: { label: string; onClick: () => void; icon?: React.ReactNode; variant?: "outline" };
    right: { label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean };
    layout?: "center";
  };

  const buttonConfigs: Record<number, ButtonConfig> = {
    [STEPS.WELCOME]: {
      right: {
        label: t("onboarding.welcome.getStarted"),
        onClick: onNext,
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
      },
      layout: "center",
    },
    [STEPS.BENEFITS]: {
      left: {
        label: t("onboarding.buttons.back"),
        onClick: onBack,
        icon: <ArrowLeft className="mr-2 w-5 h-5" />,
        variant: "outline",
      },
      right: {
        label: t("onboarding.benefits.createWorkspace"),
        onClick: onNext,
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
      },
    },
    [STEPS.CREATE_ORG]: {
      left: {
        label: t("onboarding.buttons.back"),
        onClick: onBack,
        icon: <ArrowLeft className="mr-2 w-5 h-5" />,
        variant: "outline",
      },
      right: {
        label: t("onboarding.createOrg.createButton"),
        onClick: onCreateOrganization,
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
        disabled: !formData.name.trim(),
      },
    },
    [STEPS.BRANDING]: {
      left: {
        label: t("onboarding.buttons.skip"),
        onClick: onBrandingSkip,
        icon: <SkipForward className="mr-2 w-5 h-5" />,
        variant: "outline",
      },
      right: {
        label: t("onboarding.branding.saveContinue"),
        onClick: onBrandingSave,
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
      },
    },
    [STEPS.INVITES]: {
      left: {
        label: t("onboarding.buttons.skip"),
        onClick: onInvitesSkip,
        icon: <SkipForward className="mr-2 w-5 h-5" />,
        variant: "outline",
      },
      right: {
        label: t("onboarding.buttons.continue"),
        onClick: onInvitesContinue,
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
      },
    },
    [STEPS.JOIN_ORG]: {
      left: {
        label: t("onboarding.buttons.back"),
        onClick: onBack,
        icon: <ArrowLeft className="h-4 w-4" />,
        variant: "outline",
      },
      right: {
        label: t("onboarding.joinOrg.joinButton"),
        onClick: onJoinOrganization,
        icon: <ArrowRight className="h-4 w-4" />,
        disabled: !inviteCode.trim(),
      },
    },
    [STEPS.PAYWALL]: {
      right: {
        label: t("onboarding.paywall.skip", { defaultValue: "Skip for now" }),
        onClick: onPaywallSkip || (() => {}),
        icon: <SkipForward className="ml-2 w-5 h-5" />,
      },
      layout: "center",
    },
    [STEPS.SUCCESS]: {
      right: {
        label: t("onboarding.success.goToDashboard"),
        onClick: onComplete || (() => {}),
        icon: <ArrowRight className="ml-2 w-5 h-5" />,
      },
      layout: "center",
    },
  };

  const config = buttonConfigs[currentStep];
  if (!config) return null;

  const { left, right, layout } = config;

  if (layout === "center") {
    return (
      <div className="flex justify-center">
        <Button onClick={right.onClick} size="lg" className={primaryButtonClass} disabled={right.disabled}>
          {right.label}
          {right.icon}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4">
      {left && (
        <Button
          onClick={left.onClick}
          variant={left.variant || "outline"}
          size="lg"
          className={left.variant === "outline" ? outlineButtonClass : primaryButtonClass}
        >
          {left.icon}
          {left.label}
        </Button>
      )}
      <Button
        onClick={right.onClick}
        size="lg"
        className={primaryButtonClass}
        disabled={right.disabled}
      >
        {right.label}
        {right.icon}
      </Button>
    </div>
  );
}
