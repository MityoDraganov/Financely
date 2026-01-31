import { ReactNode, useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useOrganizationsByIds } from "@/hooks/repository-hooks/use-organizations";
import { OrganizationContext, OrganizationContextType } from "./organization-context-types";

const getStorageKey = (userId: string | null | undefined): string => {
  if (!userId) return "financely_current_organization_id";
  return `financely_current_organization_id_${userId}`;
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { data: dbUser, isLoading: isUserLoading, error: userError } = useUserByClerkId(user?.id);
  
  // Get organizations by organizationRoles (memberIds query doesn't work with Firestore rules)
  const organizationIds = dbUser?.organizationRoles ? Object.keys(dbUser.organizationRoles) : [];
  const { data: organizationsByIds = [], isLoading: isOrganizationsByIdsLoading, error: orgsError } = useOrganizationsByIds(
    organizationIds.length > 0 ? organizationIds : undefined
  );
  
  // Use organizations from organizationRoles
  const organizations = organizationsByIds;

  // Stay in loading until we have a definitive db user (or know there is none).
  // When user?.id exists but dbUser is undefined, the user query may be disabled (e.g. auth not ready)
  // or still in flight — don't treat that as "loaded with no orgs" or we clear currentOrgId on refresh.
  const waitingForUser = user?.id != null && dbUser === undefined;
  const isLoading =
    !isClerkLoaded ||
    waitingForUser ||
    isUserLoading ||
    (organizationIds.length > 0 && isOrganizationsByIdsLoading);
  const error = userError || orgsError;

  // Get user-specific storage key
  const storageKey = useMemo(() => getStorageKey(user?.id), [user?.id]);

  // Track if we've processed organizations for this user
  const processedRef = useRef<string | null>(null);
  
  // Initialize state - will be set from localStorage once user is loaded
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [lastUserId, setLastUserId] = useState<string | null | undefined>(user?.id);

  // Reset state when user changes (logout/login)
  useEffect(() => {
    if (user?.id !== lastUserId) {
      setCurrentOrgId(null);
      processedRef.current = null;
      setLastUserId(user?.id);
    }
  }, [user?.id, lastUserId]);

  // Update current organization based on stored ID or first available
  // Also handle revoked access by removing revoked organizations
  useEffect(() => {
    // Wait for user and organizations to load
    if (!isClerkLoaded || !user?.id || isLoading) return;
    
    // If no organizations, clear state
    if (organizations.length === 0) {
      setCurrentOrgId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }
      processedRef.current = null;
      return;
    }

    // Skip if we've already processed these organizations for this user
    const orgIdsKey = organizations.map(o => o.id).sort().join(",");
    if (processedRef.current === orgIdsKey) {
      return;
    }

    // Get stored organization ID from localStorage
    let storedOrgId: string | null = null;
    if (typeof window !== "undefined") {
      storedOrgId = localStorage.getItem(storageKey);
    }

    // If we have a stored ID, validate it
    if (storedOrgId) {
      const org = organizations.find(o => o.id === storedOrgId);
      if (org) {
        // Verify user is still a member
        const isMember = org.memberIds?.includes(dbUser?.id || "") ?? false;
        const hasRole = dbUser?.organizationRoles?.[storedOrgId] !== undefined;
        
        if (isMember || hasRole) {
          // Valid organization - use it
          setCurrentOrgId(storedOrgId);
          processedRef.current = orgIdsKey;
          return;
        }
        
        // User was revoked from this org - remove from storage
        if (typeof window !== "undefined") {
          localStorage.removeItem(storageKey);
        }
        storedOrgId = null;
      } else {
        // Stored org doesn't exist - remove from storage
        if (typeof window !== "undefined") {
          localStorage.removeItem(storageKey);
        }
        storedOrgId = null;
      }
    }

    // No valid stored ID - use first organization
    if (!storedOrgId) {
      const firstOrg = organizations[0];
      if (firstOrg) {
        setCurrentOrgId(firstOrg.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, firstOrg.id);
        }
      }
    }

    processedRef.current = orgIdsKey;
  }, [organizations, isClerkLoaded, user?.id, isLoading, storageKey, dbUser]);

  const currentOrganization = currentOrgId 
    ? organizations.find(o => o.id === currentOrgId) || organizations[0] || null
    : organizations[0] || null;

  const switchOrganization = (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrgId(organizationId);
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, organizationId);
      }
      // Reset processed ref so effect can run again if needed
      processedRef.current = null;
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

