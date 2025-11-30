import { useQuery } from "@tanstack/react-query";
import { useUsers } from "./repository-hooks/use-users";
import { useCurrentOrganization } from "./use-current-organization";
import { OrganizationRole, ORGANIZATION_ROLES, isValidRole, ROLE_HIERARCHY } from "@/core/roles";

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

/**
 * Hook to fetch organization members with their roles
 */
export function useOrganizationMembers(organizationId?: string) {
  const { data: allUsers } = useUsers();
  const { data: organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => {
      if (!allUsers || !organization) return [];

      // Get all users who are members of this organization
      const memberIds = organization.memberIds || [];
      const members: OrganizationMember[] = [];

      memberIds.forEach((memberId: string) => {
        const user = allUsers.find(u => u.id === memberId);
        if (user) {
          // Get user's role in this organization
          const roleValue = user.organizationRoles?.[organizationId || ""];
          const role: OrganizationRole = (roleValue && isValidRole(roleValue))
            ? roleValue
            : ORGANIZATION_ROLES.MEMBER;
          
          members.push({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role,
            status: user.status,
            createdAt: user.createdAt || new Date().toISOString(),
            lastLoginAt: undefined, // User entity doesn't have lastLoginAt field yet
          });
        }
      });

      // Sort members by role hierarchy (owners first, then admins, then members, then viewers)
      members.sort((a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]);

      return members;
    },
    enabled: !!organizationId && !!allUsers && !!organization,
    // Refetch when users or organization data changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
