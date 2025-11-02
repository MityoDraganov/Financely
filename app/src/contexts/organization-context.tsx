import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useUserOrganizations, useOrganizationsByIds } from "@/hooks/repository-hooks/use-organizations";
import { Organization } from "@/core";

const CURRENT_ORG_STORAGE_KEY = "financely_current_organization_id";

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
  const error = userError || orgsError;

  // Get stored organization ID or use first available
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CURRENT_ORG_STORAGE_KEY);
    }
    return null;
  });

  // Update current organization based on stored ID or first available
  useEffect(() => {
    if (organizations.length === 0) {
      setCurrentOrgId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
      }
      return;
    }

    // If we have a stored ID and it exists in organizations, use it
    if (currentOrgId) {
      const org = organizations.find(o => o.id === currentOrgId);
      if (org) {
        return;
      }
    }

    // Otherwise, use first organization and store it
    const firstOrg = organizations[0];
    if (firstOrg) {
      setCurrentOrgId(firstOrg.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_ORG_STORAGE_KEY, firstOrg.id);
      }
    }
  }, [organizations, currentOrgId]);

  const currentOrganization = currentOrgId 
    ? organizations.find(o => o.id === currentOrgId) || organizations[0] || null
    : organizations[0] || null;

  const switchOrganization = (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrgId(organizationId);
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_ORG_STORAGE_KEY, organizationId);
      }
    }
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
