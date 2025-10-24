import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

/**
 * Hook to create a workflow using Firebase Functions
 */
export const useCreateWorkflowFunction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.createWorkflow>[0]) => 
      functionsService.createWorkflow(payload),
    onSuccess: (result, variables) => {
      // Invalidate workflows queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflows", "org", variables.orgId] });
      
      toast.success("Workflow created successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to create workflow:", error);
      toast.error(`Failed to create workflow: ${error.message || "Unknown error"}`);
    },
  });
};
