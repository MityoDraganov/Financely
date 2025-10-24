import { QueryConstraint, WorkflowTriggerType, WorkflowData, UpdateWorkflowInput } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const workflowRepository = repositoryHost.getWorkflowsRepository(databaseService);

/**
 * Hook to fetch all workflows (optionally filtered by constraints)
 */
export const useWorkflows = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["workflows", "all", queryConstraints],
    queryFn: () => workflowRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch workflows by organization ID
 */
export const useWorkflowsByOrg = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["workflows", "org", orgId],
    queryFn: () => {
      if (!orgId) return [];
      return workflowRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to fetch a single workflow by ID
 */
export const useWorkflow = (workflowId: string | undefined) => {
  return useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      if (!workflowId) return null;
      return workflowRepository.get(workflowId);
    },
    enabled: !!workflowId,
  });
};

/**
 * Hook to fetch active workflows for an organization
 */
export const useActiveWorkflows = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["workflows", "active", orgId],
    queryFn: () => {
      if (!orgId) return [];
      return workflowRepository.getActiveWorkflows(orgId);
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to fetch workflows by trigger type
 */
export const useWorkflowsByTrigger = (triggerType: WorkflowTriggerType, orgId: string | undefined) => {
  return useQuery({
    queryKey: ["workflows", "trigger", triggerType, orgId],
    queryFn: () => {
      if (!orgId) return [];
      return workflowRepository.getWorkflowsByTrigger(triggerType, orgId);
    },
    enabled: !!orgId && !!triggerType,
  });
};

/**
 * Hook to fetch n8n enabled workflows
 */
export const useN8nWorkflows = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["workflows", "n8n", orgId],
    queryFn: () => {
      if (!orgId) return [];
      return workflowRepository.getN8nWorkflows(orgId);
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to create a new workflow
 */
export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: WorkflowData) => workflowRepository.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
};

/**
 * Hook to update a workflow
 */
export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) => 
      workflowRepository.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });
};

/**
 * Hook to delete a workflow
 */
export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workflowRepository.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
};

/**
 * Hook to activate a workflow
 */
export const useActivateWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workflowRepository.update(id, { status: "active" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });
};

/**
 * Hook to pause a workflow
 */
export const usePauseWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workflowRepository.update(id, { status: "paused" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });
};

/**
 * Hook to archive a workflow
 */
export const useArchiveWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workflowRepository.update(id, { status: "archived" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });
};

/**
 * Hook to update n8n workflow ID
 */
export const useUpdateN8nWorkflowId = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ workflowId, n8nWorkflowId }: { workflowId: string; n8nWorkflowId: string }) => 
      workflowRepository.updateN8nWorkflowId(workflowId, n8nWorkflowId),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflows", "n8n"] });
    },
  });
};
