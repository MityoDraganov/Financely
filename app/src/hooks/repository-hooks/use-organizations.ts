import { Organization, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "./use-users";
import type { CreateOrganizationPayload } from "@/core/ports/services/functions-service";
import {
  logClientAuditFailure,
  logClientAuditSuccess,
} from "@/services/audit-log/audit-log-client-helper";

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
        return await organizationRepository.getAll({
          queryConstraints: [
            { field: "memberIds", operator: "array-contains", value: userId },
          ],
        });
      } catch (error) {
        console.error("useUserOrganizations failed:", error);
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
        const organizations = await Promise.all(
          organizationIds.map(id => organizationRepository.get({ id }))
        );
        
        // Filter out null results (organizations that don't exist)
        const validOrganizations = organizations.filter(org => org !== null) as Organization[];
        return validOrganizations;
      } catch (error) {
        console.error("useOrganizationsByIds failed:", error);
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
 * Uses cloud function instead of direct repository access for proper permissions
 */
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  const functionsService = serviceHost.getFunctionsService();

  return useMutation({
    mutationFn: async (data: CreateOrganizationPayload) => {
      const result = await functionsService.createOrganization(data);
      return result.organizationId;
    },
    onSuccess: () => {
      // Invalidate all organization queries to refetch
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      // Invalidate user queries since organizationRoles is updated when org is created
      queryClient.invalidateQueries({ queryKey: ["users"] });
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
      const startTime = Date.now();
      try {
        await organizationRepository.update({ id, data });

        await logClientAuditSuccess({
          organizationId: id,
          action: data.settings ? "organization.settings.updated" : "organization.updated",
          resource: {
            type: "organization",
            id,
          },
          durationMs: Date.now() - startTime,
          metadata: {
            sourceDetails: "useUpdateOrganization",
            customFields: {
              updatedFields: Object.keys(data || {}),
              hasSettings: Boolean(data.settings),
            },
          },
        });
      } catch (error) {
        await logClientAuditFailure({
          organizationId: id,
          action: data.settings ? "organization.settings.updated" : "organization.updated",
          error,
          durationMs: Date.now() - startTime,
          resource: {
            type: "organization",
            id,
          },
          metadata: {
            sourceDetails: "useUpdateOrganization",
            customFields: {
              updatedFields: Object.keys(data || {}),
              hasSettings: Boolean(data.settings),
            },
          },
        });
        throw error;
      }
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
