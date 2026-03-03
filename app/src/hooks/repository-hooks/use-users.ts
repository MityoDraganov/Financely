import { User, QueryConstraint } from "@/core";
import { OrganizationRole } from "@/core/roles";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { useAuthReady } from "@/hooks/use-auth-ready";

const databaseService = serviceHost.getDatabaseService();
const userRepository = repositoryHost.getUsersRepository(databaseService);

/**
 * Hook to fetch all users (optionally filtered by constraints)
 */
export const useUsers = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["users", "all", queryConstraints],
    queryFn: () => userRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch a single user by ID
 */
export const useUser = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => {
      if (!userId) return Promise.resolve(null);
      return userRepository.get({ id: userId });
    },
    enabled: !!userId,
  });
};

/**
 * Hook to fetch a user by Clerk ID
 */
export const useUserByClerkId = (clerkId: string | undefined) => {
  const { isSignedIn } = useAuth();
  const { isAuthReady } = useAuthReady();
  
  // Only enable query if user is signed in and auth is ready
  // This prevents queries on public pages like landing page
  const isReady = isSignedIn && isAuthReady;
  
  return useQuery({
    queryKey: ["users", "clerkId", clerkId],
    queryFn: async () => {
      if (!clerkId) return null;
      
      try {
        // First try to get by document ID (no index needed)
        // Based on the Clerk webhook, users are created with clerkId as document ID
        const user = await userRepository.get({ id: clerkId });
        if (user) {
          return user;
        }
        
        // Fallback: query by clerkId field (requires index)
        const users = await userRepository.getAll({
          queryConstraints: [
            { field: "clerkId", operator: "==", value: clerkId },
          ],
        });
        return users.length > 0 ? users[0] : null;
      } catch (error) {
        console.error("Error fetching user by Clerk ID:", error);
        // If it's an index error, try the document ID approach
        if (error instanceof Error && error.message.includes('index')) {
          try {
            const user = await userRepository.get({ id: clerkId });
            return user;
          } catch (docError) {
            console.error('Document ID approach also failed:', docError);
            return null;
          }
        }
        throw error;
      }
    },
    enabled: !!clerkId && isReady,
    retry: 1, // Only retry once
    retryDelay: 1000, // Wait 1 second before retry
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

/**
 * Hook to create a new user
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Parameters<typeof userRepository.create>[0]["data"]) => {
      return userRepository.create({ data });
    },
    onSuccess: () => {
      // Invalidate all user queries to refetch
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

/**
 * Hook to update a user
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<User>;
    }) => {
      return userRepository.update({ id, data });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific user and all lists
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["users", "all"] });
    },
  });
};

/**
 * Hook to delete a user
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return userRepository.delete({ id: userId });
    },
    onSuccess: () => {
      // Invalidate all user queries
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

/**
 * Hook to update a user's role in an organization
 */
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      organizationId,
      role,
    }: {
      userId: string;
      organizationId: string;
      role: OrganizationRole;
    }) => {
      // Fetch current user to update organizationRoles
      const user = await userRepository.get({ id: userId });
      if (!user) throw new Error("User not found");

      const updatedRoles = {
        ...user.organizationRoles,
        [organizationId]: role,
      };

      return userRepository.update({
        id: userId,
        data: { organizationRoles: updatedRoles },
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific user
      queryClient.invalidateQueries({ queryKey: ["users", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users", "all"] });
    },
  });
};

/**
 * Hook to remove a user from an organization (remove their role)
 */
export const useRemoveUserFromOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      organizationId,
    }: {
      userId: string;
      organizationId: string;
    }) => {
      // Fetch current user to update organizationRoles
      const user = await userRepository.get({ id: userId });
      if (!user) throw new Error("User not found");

      const updatedRoles = { ...user.organizationRoles };
      delete updatedRoles[organizationId];

      return userRepository.update({
        id: userId,
        data: { organizationRoles: updatedRoles },
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific user and organization queries
      queryClient.invalidateQueries({ queryKey: ["users", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users", "all"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", variables.organizationId] });
    },
  });
};
