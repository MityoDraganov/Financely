import { useQuery } from "@tanstack/react-query";
import { useUsers } from "./repository-hooks/use-users";
import { useCurrentOrganization } from "./use-current-organization";

interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member" | "viewer";
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
          const role = user.organizationRoles?.[organizationId || ""] || "member";
          
          members.push({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: role as "owner" | "admin" | "member" | "viewer",
            status: user.status,
            createdAt: user.createdAt || new Date().toISOString(),
            lastLoginAt: undefined, // User entity doesn't have lastLoginAt field yet
          });
        }
      });

      // Sort members by role (owners first, then admins, then members, then viewers)
      const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
      members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

      return members;
    },
    enabled: !!organizationId && !!allUsers && !!organization,
  });
}
