import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowService } from "@/services/workflow/workflow-service";
import { useOrganization } from "@/contexts/organization-context";
import { CreateWorkflowInput, UpdateWorkflowInput } from "@/core";

export function useWorkflows() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch workflows
  const { data: workflows = [], isLoading, error } = useQuery({
    queryKey: ["workflows", organization?.id],
    queryFn: () => workflowService.listWorkflows(organization?.id || ""),
    enabled: !!organization?.id,
  });

  // Create workflow mutation
  const createWorkflow = useMutation({
    mutationFn: (data: CreateWorkflowInput) => workflowService.createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Update workflow mutation
  const updateWorkflow = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) => 
      workflowService.updateWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Delete workflow mutation
  const deleteWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Activate workflow mutation
  const activateWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.activateWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Pause workflow mutation
  const pauseWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.pauseWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Archive workflow mutation
  const archiveWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.archiveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Execute workflow mutation
  const executeWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.executeWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions"] });
    },
  });

  return {
    workflows,
    isLoading,
    error,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    pauseWorkflow,
    archiveWorkflow,
    executeWorkflow,
  };
}

export function useWorkflow(id: string) {
  const queryClient = useQueryClient();

  // Fetch single workflow
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowService.getWorkflow(id),
    enabled: !!id,
  });

  // Update workflow mutation
  const updateWorkflow = useMutation({
    mutationFn: (data: UpdateWorkflowInput) => workflowService.updateWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Activate workflow mutation
  const activateWorkflow = useMutation({
    mutationFn: () => workflowService.activateWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Pause workflow mutation
  const pauseWorkflow = useMutation({
    mutationFn: () => workflowService.pauseWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Archive workflow mutation
  const archiveWorkflow = useMutation({
    mutationFn: () => workflowService.archiveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  // Execute workflow mutation
  const executeWorkflow = useMutation({
    mutationFn: () => workflowService.executeWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", id] });
    },
  });

  return {
    workflow,
    isLoading,
    error,
    updateWorkflow,
    activateWorkflow,
    pauseWorkflow,
    archiveWorkflow,
    executeWorkflow,
  };
}

export function useWorkflowExecutions(workflowId: string) {
  // Fetch workflow executions
  const { data: executions = [], isLoading, error } = useQuery({
    queryKey: ["workflow-executions", workflowId],
    queryFn: () => workflowService.listExecutions(workflowId),
    enabled: !!workflowId,
  });

  return {
    executions,
    isLoading,
    error,
  };
}
