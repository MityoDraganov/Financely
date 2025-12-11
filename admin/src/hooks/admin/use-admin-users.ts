import { useQuery } from "@tanstack/react-query";
import { User, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const userRepository = repositoryHost.getUsersRepository(databaseService);

/**
 * Admin hook to fetch all users (cross-org access)
 * Uses repository directly - admin Firestore rules should allow this
 * Follows the same pattern as app/src/hooks/repository-hooks/use-users.ts
 * Returns the raw useQuery result with all React Query fields (data, isLoading, error, etc.)
 */
export function useAdminUsers(queryConstraints?: QueryConstraint[]) {
  return useQuery<User[]>({
    queryKey: ["admin", "users", "all", queryConstraints],
    queryFn: () => userRepository.getAll({ 
      queryConstraints: queryConstraints || [],
      pagination: { limit: 1000 },
      orderBy: { field: "createdAt", direction: "desc" },
    }),
    staleTime: 30 * 1000,
  });
}

/**
 * Admin hook to fetch a single user
 * Follows the same pattern as app/src/hooks/repository-hooks/use-users.ts
 */
export function useAdminUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: async () => {
      if (!userId) return Promise.resolve(null);
      return userRepository.get({ id: userId });
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

