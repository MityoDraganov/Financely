import { Organization, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["organizations", "user", userId],
    queryFn: async () => {
      if (!userId) return Promise.resolve([]);
      
      try {
        console.log('useUserOrganizations: Querying for userId:', userId);
        const result = await organizationRepository.getAll({
          queryConstraints: [
            { field: "memberIds", operator: "array-contains", value: userId },
          ],
        });
        console.log('useUserOrganizations: Query result:', result);
        return result;
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    enabled: !!userId,
  });
};

/**
 * Hook to fetch organizations by their IDs (fallback for when memberIds query fails)
 */
export const useOrganizationsByIds = (organizationIds: string[] | undefined) => {
  return useQuery({
    queryKey: ["organizations", "by-ids", organizationIds],
    queryFn: async () => {
      if (!organizationIds || organizationIds.length === 0) return Promise.resolve([]);
      
      try {
        console.log('useOrganizationsByIds: Fetching organizations by IDs:', organizationIds);
        const organizations = await Promise.all(
          organizationIds.map(id => organizationRepository.get({ id }))
        );
        
        // Filter out null results (organizations that don't exist)
        const validOrganizations = organizations.filter(org => org !== null) as Organization[];
        console.log('useOrganizationsByIds: Found organizations:', validOrganizations);
        
        return validOrganizations;
      } catch (error) {
        console.error('useOrganizationsByIds: Error fetching organizations by IDs:', error);
        throw error;
      }
    },
    enabled: !!organizationIds && organizationIds.length > 0,
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

