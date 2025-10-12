import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "./repository-hooks/use-users";
import { useUserOrganizations, useOrganizationsByIds } from "./repository-hooks/use-organizations";

/**
 * Hook to determine if user needs onboarding
 * Returns true if user has no organizations
 */
export function useOnboardingStatus() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(user?.id);
  
  // Try to get organizations by memberIds first
  const { data: organizationsByMemberIds = [] } = useUserOrganizations(dbUser?.id);
  
  // If no organizations found by memberIds, try to get them by organizationRoles
  const organizationIds = dbUser?.organizationRoles ? Object.keys(dbUser.organizationRoles) : [];
  const { data: organizationsByIds = [] } = useOrganizationsByIds(
    organizationsByMemberIds.length === 0 ? organizationIds : undefined
  );
  
  // Use organizations from memberIds if available, otherwise use organizations by IDs
  const organizations = organizationsByMemberIds.length > 0 ? organizationsByMemberIds : organizationsByIds;

  // Calculate loading state
  const isLoading = !isClerkLoaded || isUserLoading;
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('useOnboardingStatus debug:', {
      isClerkLoaded,
      clerkUserId: user?.id,
      isUserLoading,
      dbUser: dbUser ? { id: dbUser.id, name: dbUser.name, organizationRoles: dbUser.organizationRoles } : null,
      userError: userError?.message,
      organizations: organizations?.map(org => ({ id: org.id, name: org.name, memberIds: org.memberIds })),
      needsOnboarding: isClerkLoaded && !isLoading && (!dbUser || !organizations || organizations.length === 0 || userError)
    });
  }

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

