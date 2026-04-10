import { useQuery } from "@tanstack/react-query";
import { useCurrentOrganization } from "./use-current-organization";
import { useAuthReady } from "./use-auth-ready";
import { OrganizationRole, ORGANIZATION_ROLES, isValidRole, ROLE_HIERARCHY } from "@/core/roles";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: OrganizationRole;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  lastLoginAt?: string;
}

const databaseService = serviceHost.getDatabaseService();
const userRepository = repositoryHost.getUsersRepository(databaseService);

/**
 * Hook to fetch organization members with their roles
 */
export function useOrganizationMembers(organizationId?: string) {
  const { data: organization } = useCurrentOrganization();
  const { isAuthReady } = useAuthReady();

  return useQuery({
    queryKey: ["organization-members", organizationId, organization?.memberIds, isAuthReady],
    queryFn: async () => {
      if (!organization || !organizationId || !isAuthReady) return [];

      // Get all users who are members of this organization
      const memberIds = organization.memberIds || [];
      if (memberIds.length === 0) return [];

      const users = await Promise.all(
        memberIds.map(async (memberId) => {
          try {
            const user = await userRepository.get({ id: memberId });
            if (!user) {
              console.warn("Organization member document not found for id:", {
                organizationId,
                memberId,
              });
            }
            return user;
          } catch (error) {
            console.error("Failed to fetch organization member by id:", {
              organizationId,
              memberId,
              error,
            });
            return null;
          }
        })
      );

      const members: OrganizationMember[] = users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => {
          // Get user's role in this organization
          const roleValue = user.organizationRoles?.[organizationId];
          const role: OrganizationRole = (roleValue && isValidRole(roleValue))
            ? roleValue
            : ORGANIZATION_ROLES.MEMBER;
          // Legacy user documents may not have an explicit status yet.
          const status = user.status === "suspended" || user.status === "deleted"
            ? user.status
            : "active";

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role,
            status,
            createdAt: user.createdAt
              ? new Date(user.createdAt).toISOString()
              : new Date().toISOString(),
            lastLoginAt: undefined, // User entity doesn't have lastLoginAt field yet
          };
        });

      // Sort members by role hierarchy (owners first, then admins, then members, then viewers)
      members.sort((a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]);

      return members;
    },
    enabled: !!organizationId && !!organization && isAuthReady,
    // Refetch when users or organization data changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
