import { DatabaseService } from "../core";
import { OnboardingProgress, OnboardingProgressData } from "../core/entities/onboarding-progress";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export interface OnboardingProgressRepository {
  create(data: OnboardingProgressData): Promise<string>;
  get(id: string): Promise<OnboardingProgress | null>;
  update(id: string, data: Partial<OnboardingProgressData>): Promise<void>;
  delete(id: string): Promise<void>;
  getByUserId(userId: string): Promise<OnboardingProgress | null>;
  getByEmail(email: string): Promise<OnboardingProgress | null>;
  updateLastActivity(id: string): Promise<void>;
}

export function getOnboardingProgressRepository(
  databaseService: DatabaseService,
): OnboardingProgressRepository {
  const genericRepo = getGenericRepository<OnboardingProgress, OnboardingProgressData>(
    () => DatabaseCollection.ONBOARDING_PROGRESS,
    databaseService,
  );

  return {
    ...genericRepo,
    
    async getByUserId(userId: string): Promise<OnboardingProgress | null> {
      const results = await databaseService.getAllByFields<OnboardingProgress>(
        DatabaseCollection.ONBOARDING_PROGRESS,
        [{ field: "data.userId", operator: "==", value: userId }],
        { limit: 1 },
      );
      
      return results.length > 0 ? results[0] : null;
    },
    
    async getByEmail(email: string): Promise<OnboardingProgress | null> {
      const results = await databaseService.getAllByFields<OnboardingProgress>(
        DatabaseCollection.ONBOARDING_PROGRESS,
        [{ field: "data.email", operator: "==", value: email }],
        { limit: 1 },
      );
      
      return results.length > 0 ? results[0] : null;
    },
    
    async updateLastActivity(id: string): Promise<void> {
      await genericRepo.update({
        id,
        data: {
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Partial<OnboardingProgressData>,
      });
    },
  };
}
