const PLAN_CONTEXT_STORAGE_KEY = "financely_plan_context";
const QUIZ_RESULTS_STORAGE_KEY = "financely_quiz_results";

export type PlanSource = "quiz" | "stripe";

export interface PlanContext {
  planId: string;
  source: PlanSource;
  timestamp: string;
}

/**
 * Store plan context in sessionStorage
 */
export function storePlanContext(planId: string, source: PlanSource): void {
  const context: PlanContext = {
    planId,
    source,
    timestamp: new Date().toISOString(),
  };
  
  sessionStorage.setItem(PLAN_CONTEXT_STORAGE_KEY, JSON.stringify(context));
}

/**
 * Retrieve plan context from sessionStorage
 */
export function getPlanContext(): PlanContext | null {
  if (typeof window === "undefined") return null;
  
  const stored = sessionStorage.getItem(PLAN_CONTEXT_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as PlanContext;
  } catch {
    return null;
  }
}

/**
 * Clear plan context from sessionStorage
 */
export function clearPlanContext(): void {
  sessionStorage.removeItem(PLAN_CONTEXT_STORAGE_KEY);
}

/**
 * Get recommended plan from quiz results
 */
export function getRecommendedPlanFromQuiz(): string | null {
  if (typeof window === "undefined") return null;
  
  const stored = sessionStorage.getItem(QUIZ_RESULTS_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const quizResult = JSON.parse(stored);
    return quizResult?.recommendedPlan || null;
  } catch {
    return null;
  }
}

/**
 * Map plan names to Stripe plan IDs or internal plan names
 * Adjust these mappings based on your actual Stripe pricing table configuration
 */
export function normalizePlanName(planName: string): string {
  const normalized = planName.toLowerCase();
  
  // Map common variations to standard plan names
  if (normalized.includes("starter") || normalized === "starter") {
    return "starter";
  }
  if (normalized.includes("professional") || normalized.includes("pro") || normalized === "professional" || normalized === "pro") {
    return "professional";
  }
  if (normalized.includes("enterprise")) {
    return "enterprise";
  }
  if (normalized.includes("free")) {
    return "free";
  }
  
  return planName;
}
