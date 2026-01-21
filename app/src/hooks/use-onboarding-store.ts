import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const STEPS = {
  WELCOME: 0,
  CHOOSE_PATH: 1,
  BENEFITS: 2,
  CREATE_ORG: 3,
  BRANDING: 4,
  INVITES: 5,
  JOIN_ORG: 6,
  SUCCESS: 7,
} as const;

interface OnboardingStore {
  currentStep: number;
  path: "create" | "join" | null;
  formData: {
    name: string;
    description: string;
    website: string;
  };
  brandingData: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  inviteCode: string;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  setCurrentStep: (step: number) => void;
  setPath: (path: "create" | "join") => void;
  setFormData: (data: Partial<OnboardingStore["formData"]>) => void;
  setBrandingData: (data: Partial<OnboardingStore["brandingData"]>) => void;
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
  brandingData: {
    primaryColor: "#2563eb",
    secondaryColor: "#6b7280",
    accentColor: "#10b981",
  },
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
      setBrandingData: (data: Partial<OnboardingStore["brandingData"]>) =>
        set({
          brandingData: { ...get().brandingData, ...data },
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

export const useOnboardingBrandingData = () =>
  useOnboardingStore((state) => state.brandingData);

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
  useOnboardingStore((state) => ({
    setCurrentStep: state.setCurrentStep,
    setPath: state.setPath,
    setFormData: state.setFormData,
    setBrandingData: state.setBrandingData,
    setInviteCode: state.setInviteCode,
    reset: state.reset,
  }));
