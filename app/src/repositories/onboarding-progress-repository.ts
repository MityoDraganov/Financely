import { DatabaseService, OnboardingProgress, OnboardingProgressData } from "@/core";
import { OnboardingProgressRepository } from "@/core/ports/repositories/onboarding-progress-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for an `OnboardingProgressRepository` backed by the provided `DatabaseService`.
 */
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
      return await databaseService.getByField<OnboardingProgress>(
        DatabaseCollection.ONBOARDING_PROGRESS,
        [{ field: "data.userId", operator: "==", value: userId }],
      );
    },
    
    async getByEmail(email: string): Promise<OnboardingProgress | null> {
      return await databaseService.getByField<OnboardingProgress>(
        DatabaseCollection.ONBOARDING_PROGRESS,
        [{ field: "data.email", operator: "==", value: email }],
      );
    },
    
    async updateLastActivity(id: string): Promise<void> {
      const existing = await genericRepo.get({ id });
      if (!existing) return;
      
      await genericRepo.update({
        id,
        data: {
          ...existing.data,
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    },
  };
}
