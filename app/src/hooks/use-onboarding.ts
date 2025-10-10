import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "./repository-hooks/use-users";
import { useUserOrganizations } from "./repository-hooks/use-organizations";

/**
 * Hook to determine if user needs onboarding
 * Returns true if user has no organizations
 */
export function useOnboardingStatus() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(user?.id);
  const { data: organizations } = useUserOrganizations(dbUser?.id);

  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('useOnboardingStatus debug:', {
      isClerkLoaded,
      clerkUserId: user?.id,
      isUserLoading,
      dbUser,
      userError,
      organizations
    });
  }

  // Calculate loading state
  const isLoading = !isClerkLoaded || isUserLoading;

  // Determine if onboarding is needed
  // User needs onboarding if:
  // 1. Clerk is loaded and not loading anymore
  // 2. AND either:
  //    a. User doesn't exist in database yet (dbUser is null/undefined)
  //    b. OR user exists but has no organizations
  //    c. OR there was an error fetching the user (index error, etc.)
  const needsOnboarding = 
    isClerkLoaded && 
    !isLoading && 
    (!dbUser || !organizations || organizations.length === 0 || userError);

  return {
    needsOnboarding,
    isLoading,
    user: dbUser,
    organizations: organizations || [],
  };
}

