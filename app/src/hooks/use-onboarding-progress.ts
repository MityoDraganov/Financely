import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { databaseService } from "@/services/database/database-service";
import { getOnboardingProgressRepository } from "@/repositories/onboarding-progress-repository";
import {
  OnboardingProgress,
  OnboardingProgressData,
} from "@/core/entities/onboarding-progress";
import {
  saveProgressLocally,
  loadProgressLocally,
  clearProgressLocally,
  getSessionId,
} from "@/utils/progress-storage";

const progressRepo = getOnboardingProgressRepository(databaseService);
const DEBOUNCE_MS = 2000; // 2 seconds debounce for Firestore saves

export function useOnboardingProgress() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [localProgress, setLocalProgress] = useState<OnboardingProgress | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Generate progress ID (userId if signed in, sessionId if anonymous)
  const progressId = user?.id || getSessionId();

  // Load progress from backend
  const { data: backendProgress, isLoading } = useQuery<OnboardingProgress | null>({
    queryKey: ["onboarding-progress", progressId],
    queryFn: async () => {
      if (user?.id) {
        return await progressRepo.getByUserId(user.id);
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  // Load local progress on mount
  useEffect(() => {
    const local = loadProgressLocally();
    if (local) {
      setLocalProgress(local);
    }
  }, []);

  // Merge backend and local progress (local takes precedence)
  const currentProgress = localProgress || backendProgress || null;

  // Create progress mutation
  const createProgress = useMutation({
    mutationFn: async (data: OnboardingProgressData) => {
      const id = await progressRepo.create({ data });
      return { id, data } as OnboardingProgress;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["onboarding-progress", progressId], data);
      setLocalProgress(data);
      saveProgressLocally(data);
    },
  });

  // Update progress mutation
  const updateProgress = useMutation({
    mutationFn: async (updates: Partial<OnboardingProgressData>) => {
      if (!currentProgress?.id) {
        // Create new progress if it doesn't exist
        const now = new Date().toISOString();
        const newData: OnboardingProgressData = {
          userId: user?.id,
          email: user?.emailAddresses[0]?.emailAddress,
          currentStep: 0,
          stepData: {},
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
          ...updates,
        };
        const id = await progressRepo.create({ data: newData });
        return { id, data: newData, createdAt: newData.createdAt, updatedAt: newData.updatedAt } as OnboardingProgress;
      }

      await progressRepo.update({
        id: currentProgress.id,
        data: {
          ...currentProgress.data,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      });

      const updated = {
        ...currentProgress,
        data: {
          ...currentProgress.data,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      };

      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["onboarding-progress", progressId], data);
      setLocalProgress(data);
      saveProgressLocally(data);
    },
  });

  // Debounced save to Firestore
  const debouncedSave = useCallback(
    (progress: OnboardingProgress) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Save to localStorage immediately
      saveProgressLocally(progress);
      setLocalProgress(progress);

      // Debounce Firestore save
      setIsSyncing(true);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (progress.id) {
            await progressRepo.update({
              id: progress.id,
              data: {
                ...progress.data,
                lastActivityAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            });
          } else {
            // Create new progress
            const id = await progressRepo.create({ data: progress.data });
            queryClient.setQueryData(["onboarding-progress", progressId], {
              ...progress,
              id,
            });
          }
        } catch (error) {
          console.error("Failed to save progress to backend:", error);
        } finally {
          setIsSyncing(false);
        }
      }, DEBOUNCE_MS);
    },
    [progressId, queryClient]
  );

  // Save progress (immediate local, debounced backend)
  const saveProgress = useCallback(
    (updates: Partial<OnboardingProgressData>) => {
      if (!currentProgress) {
        // Create new progress
        const now = new Date().toISOString();
        const newData: OnboardingProgressData = {
          userId: user?.id,
          email: user?.emailAddresses[0]?.emailAddress,
          currentStep: 0,
          stepData: {},
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
          ...updates,
        };
        const newProgress: OnboardingProgress = {
          id: progressId,
          data: newData,
        };
        debouncedSave(newProgress);
        return;
      }

      const updated: OnboardingProgress = {
        ...currentProgress,
        data: {
          ...currentProgress.data,
          ...updates,
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      debouncedSave(updated);
    },
    [currentProgress, user, progressId, debouncedSave]
  );

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    if (currentProgress?.id) {
      progressRepo.updateLastActivity(currentProgress.id);
    }
  }, [currentProgress]);

  // Clear progress
  const clearProgress = useCallback(() => {
    if (currentProgress?.id) {
      progressRepo.delete({ id: currentProgress.id });
    }
    clearProgressLocally();
    setLocalProgress(null);
    queryClient.removeQueries({ queryKey: ["onboarding-progress", progressId] });
  }, [currentProgress, progressId, queryClient]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (localProgress) {
        // Immediate save on unload
        saveProgressLocally(localProgress);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localProgress]);

  return {
    progress: currentProgress,
    isLoading,
    isSyncing,
    saveProgress,
    updateLastActivity,
    clearProgress,
    createProgress: createProgress.mutateAsync,
    updateProgress: updateProgress.mutateAsync,
  };
}
