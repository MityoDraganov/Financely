import { useUser } from "@clerk/clerk-react";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { ORGANIZATION_ROLES } from "@/core/roles";

/**
 * Helper to enrich function call payloads with user context for audit logging
 */
export function useFunctionCallHelper() {
  const { user } = useUser();
  const { currentOrganization } = useOrganizationContext();

  const enrichPayload = <T extends Record<string, unknown>>(
    payload: T
  ): T & { userContext?: { userId: string; clerkId: string; email: string; name: string; role?: string } } => {
    if (!user || !currentOrganization) {
      return payload;
    }

    // Get user role in organization (simplified - actual role should come from user document)
    const userRole = currentOrganization.memberIds?.includes(user.id)
      ? ORGANIZATION_ROLES.MEMBER
      : undefined;

    return {
      ...payload,
      userContext: {
        userId: user.id,
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        name: user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "",
        role: userRole,
      },
    };
  };

  return { enrichPayload };
}

