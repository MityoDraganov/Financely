import { LeadData, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/hooks/use-auth-ready";

const databaseService = serviceHost.getDatabaseService();
const leadRepository = repositoryHost.getLeadsRepository(databaseService);

/**
 * Hook to fetch all leads (optionally filtered by constraints)
 */
export const useLeads = (queryConstraints?: QueryConstraint[]) => {
  const { isAuthReady } = useAuthReady();
  
  return useQuery({
    queryKey: ["leads", "all", queryConstraints],
    queryFn: () => leadRepository.getAll({ queryConstraints: queryConstraints || [] }),
    enabled: isAuthReady,
  });
};

/**
 * Hook to fetch leads by organization ID
 */
export const useLeadsByOrg = (orgId: string | undefined) => {
  const { isAuthReady } = useAuthReady();
  
  return useQuery({
    queryKey: ["leads", "org", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      // Note: Data is stored flat in Firestore, not nested under "data"
      return leadRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: orgId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!orgId && isAuthReady,
  });
};

/**
 * Hook to fetch a single lead by ID
 */
export const useLead = (leadId: string | undefined) => {
  const { isAuthReady } = useAuthReady();
  
  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      return leadRepository.get({ id: leadId });
    },
    enabled: !!leadId && isAuthReady,
  });
};

/**
 * Hook to update a lead
 */
export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadData> }) => {
      return leadRepository.update({ id, data });
    },
    onSuccess: (_, { id, data }) => {
      // Invalidate and refetch leads queries
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads", id] });
      
      // If we have organizationId, also invalidate org-specific queries
      if (data.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["leads", "org", data.organizationId] 
        });
      }
    },
  });
};

