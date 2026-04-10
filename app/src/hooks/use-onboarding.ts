import { useAuth } from "@clerk/clerk-react";
import { useUserByClerkId } from "./repository-hooks/use-users";
import { useOrganizationsByIds } from "./repository-hooks/use-organizations";
import { useAuthReady } from "./use-auth-ready";
import { useMemo, useEffect } from "react";

const ONBOARDING_COMPLETE_KEY = "financely_onboarding_complete";

/**
 * Hook to determine if user needs onboarding
 * Returns true if user has no organizations
 * 
 * Logic:
 * - User needs onboarding ONLY if:
 *   1. All data is loaded (not in loading state)
 *   2. User exists in database
 *   3. User has NO organizations (confirmed empty array, not undefined)
 *   4. Onboarding hasn't been marked as complete in localStorage
 */
export function useOnboardingStatus() {
  const { isLoaded: isClerkLoaded, isSignedIn, userId } = useAuth();
  const { isAuthReady } = useAuthReady();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(userId);
  
  // Get organizations by organizationRoles (memberIds query doesn't work with Firestore rules)
  const organizationIds = dbUser?.organizationRoles ? Object.keys(dbUser.organizationRoles) : [];
  const { 
    data: organizationsByIds,
    isLoading: isOrganizationsByIdsLoading,
    error: organizationsError,
  } = useOrganizationsByIds(
    organizationIds.length > 0 ? organizationIds : undefined
  );
  
  // Use organizations from organizationRoles
  const organizations = organizationsByIds ?? [];

  // Keep loading while signed-in auth is still being bridged to Firebase/queries,
  // or while dependent query data is still unresolved (undefined).
  const waitingForSignedInAuth = isSignedIn && (!userId || !isAuthReady);
  const waitingForUser = isSignedIn && !!userId && dbUser === undefined && !userError;
  const waitingForOrganizations =
    organizationIds.length > 0 &&
    organizationsByIds === undefined &&
    !organizationsError;

  // Calculate loading state - include all loading states
  const isLoading = 
    !isClerkLoaded || 
    waitingForSignedInAuth ||
    waitingForUser ||
    isUserLoading || 
    waitingForOrganizations ||
    (organizationIds.length > 0 && isOrganizationsByIdsLoading);

  // Check if onboarding was previously completed (stored in localStorage)
  const onboardingComplete = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
  }, []);

  // Determine if onboarding is needed
  // CRITICAL: Only return true when we're 100% certain:
  // 1. All loading is complete
  // 2. User exists in database (dbUser is not null/undefined)
  // 3. Organizations array is confirmed empty (length === 0, not undefined)
  // 4. Onboarding hasn't been marked as complete
  // 5. No errors occurred that might indicate a transient state
  const needsOnboarding = useMemo(() => {
    // If still loading, we can't determine yet - return false to prevent redirects
    if (isLoading) {
      return false;
    }

    // If Clerk isn't loaded, we can't determine yet
    if (!isClerkLoaded) {
      return false;
    }

    // If onboarding was already completed, user doesn't need onboarding
    if (onboardingComplete) {
      return false;
    }

    // If user has organizations, they don't need onboarding
    if (organizations.length > 0) {
      return false;
    }

    // If user doesn't exist in database yet, they need onboarding
    if (!dbUser) {
      return true;
    }

    // If there was an error fetching user, we can't be certain - don't redirect
    if (userError) {
      return false;
    }

    // User exists, no organizations, and onboarding not complete = needs onboarding
    // This is the only case where we're certain they need onboarding
    return true;
  }, [isLoading, isClerkLoaded, dbUser, organizations.length, onboardingComplete, userError]);

  const completeOnboarding = () => {
    // Mark onboarding as complete in localStorage
    // This persists across page refreshes and prevents unnecessary redirects
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    }
  };

  // Auto-mark onboarding as complete when user gets their first organization
  useEffect(() => {
    if (!isLoading && organizations.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    }
  }, [isLoading, organizations.length]);

  return {
    needsOnboarding,
    isLoading,
    user: dbUser,
    organizations: organizations || [],
    completeOnboarding,
  };
}
