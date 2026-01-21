import { OnboardingProgress } from "@/core/entities/onboarding-progress";

const PROGRESS_STORAGE_KEY = "financely_onboarding_progress";

/**
 * Save progress to localStorage (immediate)
 */
export function saveProgressLocally(progress: OnboardingProgress): void {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error("Failed to save progress locally:", error);
  }
}

/**
 * Load progress from localStorage
 */
export function loadProgressLocally(): OnboardingProgress | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = sessionStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored) as OnboardingProgress;
  } catch (error) {
    console.error("Failed to load progress locally:", error);
    return null;
  }
}

/**
 * Clear progress from localStorage
 */
export function clearProgressLocally(): void {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear progress locally:", error);
  }
}

/**
 * Generate a unique session ID for anonymous users
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create session ID from sessionStorage
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return generateSessionId();
  
  const key = "financely_session_id";
  let sessionId = sessionStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}
