import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export const STEPS = {
  WELCOME: 0,
  CHOOSE_PATH: 1,
  BUSINESS_DETAILS: 2,
  BUSINESS_DESCRIPTION: 3,
  BRANDING: 4,
  TEMPLATE_SUGGESTIONS: 5,
  JOIN_ORG: 6,
  SIGN_UP: 7,
  PAYWALL: 8,
  INVITE_MEMBERS: 9,
  SUCCESS: 10,
} as const;

interface OnboardingStore {
  currentStep: number;
  path: "create" | "join" | null;
  formData: {
    name: string;
    description: string;
    website: string;
  };
  businessData: {
    country: string;
    currency: string;
    logoUrl: string;
    businessDescription: string;
    businessType: string;
    suggestedServices: string[];
    industry: string;
    templateKeywords: string[];
  };
  brandingData: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  selectedTemplates: string[];
  inviteCode: string;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  setCurrentStep: (step: number) => void;
  setPath: (path: "create" | "join") => void;
  setFormData: (data: Partial<OnboardingStore["formData"]>) => void;
  setBusinessData: (data: Partial<OnboardingStore["businessData"]>) => void;
  setBrandingData: (data: Partial<OnboardingStore["brandingData"]>) => void;
  setSelectedTemplates: (templates: string[]) => void;
  setInviteCode: (code: string) => void;
  reset: () => void;
  hasInProgressData: () => boolean;
}

const initialState = {
  currentStep: STEPS.WELCOME,
  path: null as "create" | "join" | null,
  formData: {
    name: "",
    description: "",
    website: "",
  },
  businessData: {
    country: "",
    currency: "EUR",
    logoUrl: "",
    businessDescription: "",
    businessType: "",
    suggestedServices: [] as string[],
    industry: "",
    templateKeywords: [] as string[],
  },
  brandingData: {
    primaryColor: "#2563eb",
    secondaryColor: "#6b7280",
    accentColor: "#10b981",
  },
  selectedTemplates: [] as string[],
  inviteCode: "",
  startedAt: null as number | null,
  lastUpdatedAt: null as number | null,
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setCurrentStep: (step: number) =>
        set({
          currentStep: step,
          lastUpdatedAt: Date.now(),
        }),
      setPath: (path: "create" | "join") =>
        set({
          path,
          startedAt: get().startedAt || Date.now(),
          lastUpdatedAt: Date.now(),
        }),
      setFormData: (data: Partial<OnboardingStore["formData"]>) =>
        set({
          formData: { ...get().formData, ...data },
          lastUpdatedAt: Date.now(),
        }),
      setBusinessData: (data: Partial<OnboardingStore["businessData"]>) =>
        set({
          businessData: { ...get().businessData, ...data },
          lastUpdatedAt: Date.now(),
        }),
      setBrandingData: (data: Partial<OnboardingStore["brandingData"]>) =>
        set({
          brandingData: { ...get().brandingData, ...data },
          lastUpdatedAt: Date.now(),
        }),
      setSelectedTemplates: (templates: string[]) =>
        set({
          selectedTemplates: templates,
          lastUpdatedAt: Date.now(),
        }),
      setInviteCode: (code: string) =>
        set({
          inviteCode: code,
          lastUpdatedAt: Date.now(),
        }),
      reset: () =>
        set({
          ...initialState,
        }),
      hasInProgressData: () => {
        const state = get();
        return (
          state.currentStep > STEPS.WELCOME ||
          state.path !== null ||
          state.formData.name !== "" ||
          state.inviteCode !== ""
        );
      },
    }),
    {
      name: "financely-onboarding-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Selector hooks following existing pattern
export const useOnboardingStep = () =>
  useOnboardingStore((state) => state.currentStep);

export const useOnboardingPath = () =>
  useOnboardingStore((state) => state.path);

export const useOnboardingFormData = () =>
  useOnboardingStore((state) => state.formData);

export const useOnboardingBusinessData = () =>
  useOnboardingStore((state) => state.businessData);

export const useOnboardingBrandingData = () =>
  useOnboardingStore((state) => state.brandingData);

export const useOnboardingSelectedTemplates = () =>
  useOnboardingStore((state) => state.selectedTemplates);

export const useOnboardingInviteCode = () =>
  useOnboardingStore((state) => state.inviteCode);

// Computed selector for hasInProgressData to avoid infinite loops
export const useHasInProgressData = () =>
  useOnboardingStore((state) =>
    state.currentStep > STEPS.WELCOME ||
    state.path !== null ||
    state.formData.name !== "" ||
    state.inviteCode !== ""
  );

export const useOnboardingActions = () =>
  useOnboardingStore(
    useShallow((state) => ({
      setCurrentStep: state.setCurrentStep,
      setPath: state.setPath,
      setFormData: state.setFormData,
      setBusinessData: state.setBusinessData,
      setBrandingData: state.setBrandingData,
      setSelectedTemplates: state.setSelectedTemplates,
      setInviteCode: state.setInviteCode,
      reset: state.reset,
    }))
  );
