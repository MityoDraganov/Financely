import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "./repository-hooks/use-users";
import { useOrganizationsByIds } from "./repository-hooks/use-organizations";

/**
 * Hook to determine if user needs onboarding
 * Returns true if user has no organizations
 */
export function useOnboardingStatus() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(user?.id);
  
  // Get organizations by organizationRoles (memberIds query doesn't work with Firestore rules)
  const organizationIds = dbUser?.organizationRoles ? Object.keys(dbUser.organizationRoles) : [];
  const { 
    data: organizationsByIds = [], 
    isLoading: isOrganizationsByIdsLoading 
  } = useOrganizationsByIds(
    organizationIds.length > 0 ? organizationIds : undefined
  );
  
  // Use organizations from organizationRoles
  const organizations = organizationsByIds;

  // Calculate loading state - include all loading states
  const isLoading = 
    !isClerkLoaded || 
    isUserLoading || 
    (organizationIds.length > 0 && isOrganizationsByIdsLoading);

  // Determine if onboarding is needed
  // User needs onboarding if:
  // 1. Clerk is loaded and not loading anymore
  // 2. AND we have confirmed data (not just loading state)
  // 3. AND either:
  //    a. User doesn't exist in database yet (dbUser is null/undefined)
  //    b. OR user exists but has no organizations (confirmed, not just loading)
  //    c. OR there was an error fetching the user (index error, etc.)
  // 
  // Important: Only set needsOnboarding to true when we're CERTAIN, not during loading
  const needsOnboarding = 
    isClerkLoaded && 
    !isLoading && 
    (!dbUser || (organizations && organizations.length === 0) || userError);

  const completeOnboarding = () => {
    // This function is called when onboarding is complete
    // In a real implementation, you might want to set a flag in localStorage
    // or trigger a refetch of the user data
    console.log("Onboarding completed");
  };

  return {
    needsOnboarding,
    isLoading,
    user: dbUser,
    organizations: organizations || [],
    completeOnboarding,
  };
}

