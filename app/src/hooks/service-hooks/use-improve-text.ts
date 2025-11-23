import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

/**
 * Hook to improve text using AI
 */
export function useImproveText() {
  return useMutation({
    mutationFn: async (payload: Parameters<typeof functionsService.improveText>[0]) => {
      return await functionsService.improveText(payload);
    },
    onError: (error: Error) => {
      toast.error("Failed to improve text", {
        description: error.message,
      });
    },
  });
}

