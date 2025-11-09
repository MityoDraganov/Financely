import { useUser } from "@clerk/clerk-react";
import { useOrganizationContext } from "@/contexts/organization-context";

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

    // Get user role in organization
    const userRole = currentOrganization.memberIds?.includes(user.id)
      ? "member"
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

