import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { OrganizationRole } from "@/core/roles";

const databaseService = serviceHost.getDatabaseService();
const userRepository = repositoryHost.getUsersRepository(databaseService);

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: OrganizationRole;
  status: "active" | "suspended" | "deleted";
  clerkId: string;
}

/**
 * Admin hook to fetch organization members
 * Fetches all users and filters by organization membership
 */
export function useAdminOrganizationMembers(organizationId: string | undefined) {
  return useQuery<OrganizationMember[]>({
    queryKey: ["admin", "organizations", organizationId, "members"],
    queryFn: async () => {
      if (!organizationId) return [];

      // Fetch all users (admin has cross-org access)
      const allUsers = await userRepository.getAll({
        pagination: { limit: 1000 },
      });

      // Filter users who are members of this organization
      const members: OrganizationMember[] = [];

      for (const user of allUsers) {
        const orgRole = user.organizationRoles?.[organizationId];
        if (orgRole) {
          members.push({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: orgRole,
            status: user.status || "active",
            clerkId: user.clerkId,
          });
        }
      }

      return members;
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });
}

