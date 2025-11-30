import { Organization, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "./use-users";
import { firebase } from "@/infrastructure";

const databaseService = serviceHost.getDatabaseService();
const organizationRepository = repositoryHost.getOrganizationsRepository(databaseService);

/**
 * Hook to fetch all organizations (optionally filtered by constraints)
 */
export const useOrganizations = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["organizations", "all", queryConstraints],
    queryFn: () => organizationRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch a single organization by ID
 */
export const useOrganization = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => {
      if (!organizationId) return Promise.resolve(null);
      return organizationRepository.get({ id: organizationId });
    },
    enabled: !!organizationId,
  });
};

/**
 * Hook to fetch organizations where a specific user is a member
 */
export const useUserOrganizations = (userId: string | undefined) => {
  const { isAuthReady } = useAuthReady();
  const { user: clerkUser, isSignedIn } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  
  // Only enable query if:
  // 1. User is signed in
  // 2. Auth is ready
  // 3. User document is loaded (or user doesn't exist yet)
  // 4. userId is provided
  const isReady = isSignedIn && isAuthReady && (!!dbUser || !clerkUser?.id);
  
  return useQuery({
    queryKey: ["organizations", "user", userId],
    queryFn: async () => {
      if (!userId) return Promise.resolve([]);
      
      try {
        const currentUser = firebase.auth.currentUser;
        console.log('[QUERY DEBUG] useUserOrganizations: Starting query', {
          userId,
          firebaseAuthUid: currentUser?.uid,
          isAuthenticated: currentUser !== null,
        });
        
        const result = await organizationRepository.getAll({
          queryConstraints: [
            { field: "memberIds", operator: "array-contains", value: userId },
          ],
        });
        
        console.log('[QUERY DEBUG] useUserOrganizations: ✅ Success', {
          resultCount: result.length,
        });
        return result;
      } catch (error) {
        const currentUser = firebase.auth.currentUser;
        console.error('[QUERY DEBUG] useUserOrganizations: ❌ Error', {
          error,
          userId,
          firebaseAuthUid: currentUser?.uid,
          isAuthenticated: currentUser !== null,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined,
        });
        throw error;
      }
    },
    enabled: !!userId && isReady,
  });
};

/**
 * Hook to fetch organizations by their IDs (fallback for when memberIds query fails)
 */
export const useOrganizationsByIds = (organizationIds: string[] | undefined) => {
  const { isAuthReady } = useAuthReady();
  const { isSignedIn } = useUser();
  
  // Only enable query if user is signed in and auth is ready
  const isReady = isSignedIn && isAuthReady;
  
  return useQuery({
    queryKey: ["organizations", "by-ids", organizationIds],
    queryFn: async () => {
      if (!organizationIds || organizationIds.length === 0) return Promise.resolve([]);
      
      try {
        const currentUser = firebase.auth.currentUser;
        console.log('[QUERY DEBUG] useOrganizationsByIds: Starting query', {
          organizationIds,
          firebaseAuthUid: currentUser?.uid,
          isAuthenticated: currentUser !== null,
        });
        
        const organizations = await Promise.all(
          organizationIds.map(id => organizationRepository.get({ id }))
        );
        
        // Filter out null results (organizations that don't exist)
        const validOrganizations = organizations.filter(org => org !== null) as Organization[];
        
        console.log('[QUERY DEBUG] useOrganizationsByIds: ✅ Success', {
          requested: organizationIds.length,
          found: validOrganizations.length,
        });
        
        return validOrganizations;
      } catch (error) {
        const currentUser = firebase.auth.currentUser;
        console.error('[QUERY DEBUG] useOrganizationsByIds: ❌ Error', {
          error,
          organizationIds,
          firebaseAuthUid: currentUser?.uid,
          isAuthenticated: currentUser !== null,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined,
        });
        throw error;
      }
    },
    enabled: !!organizationIds && organizationIds.length > 0 && isReady,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

/**
 * Hook to create a new organization
 */
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Parameters<typeof organizationRepository.create>[0]["data"]) => {
      return organizationRepository.create({ data });
    },
    onSuccess: () => {
      // Invalidate all organization queries to refetch
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
};

/**
 * Hook to update an organization
 */
export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Organization>;
    }) => {
      return organizationRepository.update({ id, data });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific organization and all lists
      queryClient.invalidateQueries({ queryKey: ["organizations", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "all"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "user"] });
    },
  });
};

/**
 * Hook to delete an organization
 */
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      return organizationRepository.delete({ id: organizationId });
    },
    onSuccess: () => {
      // Invalidate all organization queries
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
};

/**
 * Hook to add a member to an organization
 */
export const useAddOrganizationMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => {
      return organizationRepository.addToSet({
        id: organizationId,
        fieldName: "memberIds",
        value: userId,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific organization
      queryClient.invalidateQueries({ queryKey: ["organizations", variables.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "all"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "user", variables.userId] });
    },
  });
};

/**
 * Hook to remove a member from an organization
 */
export const useRemoveOrganizationMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => {
      return organizationRepository.removeFromSet({
        id: organizationId,
        fieldName: "memberIds",
        value: userId,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific organization
      queryClient.invalidateQueries({ queryKey: ["organizations", variables.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "all"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", "user", variables.userId] });
    },
  });
};

