import { OnboardingProgress, OnboardingProgressData } from "@/core/entities/onboarding-progress";
import { GenericRepository } from "./generic-repository";

export interface OnboardingProgressRepository extends GenericRepository<OnboardingProgress, OnboardingProgressData> {
  getByUserId(userId: string): Promise<OnboardingProgress | null>;
  getByEmail(email: string): Promise<OnboardingProgress | null>;
  updateLastActivity(id: string): Promise<void>;
}
