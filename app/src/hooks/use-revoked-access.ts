import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUserOrganizations } from "@/hooks/repository-hooks/use-organizations";
import { useQueryClient } from "@tanstack/react-query";

const REVOKED_ACCESS_SHOWN_KEY = "financely_revoked_access_shown";

/**
 * Hook to detect if the current user has been revoked from the current organization
 * Returns true if the user has been revoked and hasn't seen the message yet
 */
export function useRevokedAccess() {
  const { user: clerkUser } = useUser();
  const { data: dbUser, refetch: refetchUser } = useUserByClerkId(clerkUser?.id);
  const { data: organization } = useCurrentOrganization();
  const { refetch: refetchOrganizations } = useUserOrganizations(dbUser?.id);
  const queryClient = useQueryClient();
  const [isRevoked, setIsRevoked] = useState(false);
  const [hasShownMessage, setHasShownMessage] = useState(false);

  // Refetch data when user comes back online
  useEffect(() => {
    const handleOnline = async () => {
      // Refetch user and organization data when coming back online
      await Promise.all([
        refetchUser(),
        refetchOrganizations(),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["users", "all"] }),
        queryClient.refetchQueries({ queryKey: ["organizations", "user"] }),
      ]);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refetchUser, refetchOrganizations, queryClient]);

  // Poll for revoked access every 10 seconds when user is signed in
  useEffect(() => {
    if (!clerkUser || !dbUser || !organization) {
      setIsRevoked(false);
      setHasShownMessage(false);
      return;
    }

    // Check if user is still a member of the organization
    const checkRevoked = () => {
      const isMember = organization.memberIds?.includes(dbUser.id) ?? false;
      const hasRole = dbUser.organizationRoles?.[organization.id] !== undefined;
      const revoked = !isMember && !hasRole;

      if (revoked) {
        // Check if we've already shown the message for this organization
        const shownKey = `${REVOKED_ACCESS_SHOWN_KEY}_${organization.id}`;
        const hasShown = localStorage.getItem(shownKey) === "true";
        
        setIsRevoked(true);
        setHasShownMessage(hasShown);
        
        // If revoked, invalidate queries to force refresh
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      } else {
        setIsRevoked(false);
        setHasShownMessage(false);
      }
    };

    // Check immediately
    checkRevoked();

    // Set up polling to check every 10 seconds
    const interval = setInterval(() => {
      // Refetch data first, then check
      Promise.all([
        refetchUser(),
        refetchOrganizations(),
      ]).then(() => {
        checkRevoked();
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [clerkUser, dbUser, organization, queryClient, refetchUser, refetchOrganizations]);

  return {
    isRevoked,
    shouldShowMessage: isRevoked && !hasShownMessage,
    organizationId: organization?.id,
  };
}

