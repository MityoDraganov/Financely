import { useQuery } from "@tanstack/react-query";
import { Organization, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const organizationRepository = repositoryHost.getOrganizationsRepository(databaseService);

/**
 * Admin hook to fetch all organizations (cross-org access)
 * Uses repository directly - admin Firestore rules should allow this
 * Follows the same pattern as app/src/hooks/repository-hooks/use-organizations.ts
 * Returns the raw useQuery result with all React Query fields (data, isLoading, error, etc.)
 */
export function useAdminOrganizations(queryConstraints?: QueryConstraint[]) {
  return useQuery<Organization[]>({
    queryKey: ["admin", "organizations", "all", queryConstraints],
    queryFn: () => organizationRepository.getAll({ 
      queryConstraints: queryConstraints || [],
      pagination: { limit: 1000 }, // Get all orgs
      orderBy: { field: "createdAt", direction: "desc" },
    }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Admin hook to fetch a single organization
 * Follows the same pattern as app/src/hooks/repository-hooks/use-organizations.ts
 */
export function useAdminOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "organizations", orgId],
    queryFn: async () => {
      if (!orgId) return Promise.resolve(null);
      return organizationRepository.get({ id: orgId });
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });
}

