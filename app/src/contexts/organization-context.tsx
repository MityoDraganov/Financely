import { createContext, useContext, ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useUserOrganizations, useOrganizationsByIds } from "@/hooks/repository-hooks/use-organizations";
import { Organization } from "@/core";

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  error: Error | null;
  switchOrganization: (organizationId: string) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(user?.id);
  
  // Try to get organizations by memberIds first
  const { data: organizationsByMemberIds = [], isLoading: isOrganizationsLoading, error: orgsError } = useUserOrganizations(dbUser?.id);
  
  // If no organizations found by memberIds, try to get them by organizationRoles
  const organizationIds = dbUser?.organizationRoles ? Object.keys(dbUser.organizationRoles) : [];
  const { data: organizationsByIds = [], isLoading: isOrganizationsByIdsLoading } = useOrganizationsByIds(
    organizationsByMemberIds.length === 0 ? organizationIds : undefined
  );
  
  // Use organizations from memberIds if available, otherwise use organizations by IDs
  const organizations = organizationsByMemberIds.length > 0 ? organizationsByMemberIds : organizationsByIds;
  
  const isLoading = !isClerkLoaded || isUserLoading || isOrganizationsLoading || isOrganizationsByIdsLoading;
  const currentOrganization = organizations.length > 0 ? organizations[0] : null; // For now, use first organization
  const error = userError || orgsError;

  const switchOrganization = (organizationId: string) => {
    // TODO: Implement organization switching logic
    // This could involve updating user preferences or using a state management solution
    console.log("Switching to organization:", organizationId);
  };

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    isLoading,
    error,
    switchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganizationContext must be used within an OrganizationProvider");
  }
  return context;
}

// Convenience hook for getting current organization
export function useCurrentOrganization() {
  const { currentOrganization, isLoading } = useOrganizationContext();
  return { data: currentOrganization, isLoading };
}
