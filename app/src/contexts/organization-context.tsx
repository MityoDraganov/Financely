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
  // Also handle revoked access by removing revoked organizations
  useEffect(() => {
    if (organizations.length === 0) {
      setCurrentOrgId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
      }
      return;
    }

    // If we have a stored ID, check if it still exists in organizations
    if (currentOrgId) {
      const org = organizations.find(o => o.id === currentOrgId);
      if (org) {
        // Also verify user is still a member (check memberIds and organizationRoles)
        const isMember = org.memberIds?.includes(dbUser?.id || "") ?? false;
        const hasRole = dbUser?.organizationRoles?.[currentOrgId] !== undefined;
        
        // If user is not a member and has no role, they've been revoked
        if (!isMember && !hasRole && dbUser) {
          // Remove from localStorage and switch to another org
          if (typeof window !== "undefined") {
            localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
          }
          const otherOrg = organizations.find(o => o.id !== currentOrgId);
          if (otherOrg) {
            setCurrentOrgId(otherOrg.id);
            if (typeof window !== "undefined") {
              localStorage.setItem(CURRENT_ORG_STORAGE_KEY, otherOrg.id);
            }
          } else {
            setCurrentOrgId(null);
          }
          return;
        }
        
        // Organization exists and user is still a member
        return;
      } else {
        // Stored org ID doesn't exist in organizations list - user was revoked
        // Switch to first available org or clear
        const firstOrg = organizations[0];
        if (firstOrg) {
          setCurrentOrgId(firstOrg.id);
          if (typeof window !== "undefined") {
            localStorage.setItem(CURRENT_ORG_STORAGE_KEY, firstOrg.id);
          }
        } else {
          setCurrentOrgId(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
          }
        }
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
  }, [organizations, currentOrgId, dbUser]);

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
