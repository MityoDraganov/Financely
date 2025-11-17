import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

/**
 * Hook for chat-based site generation
 */
export const useChatGenerateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.chatGenerateSite>[0]) =>
      functionsService.chatGenerateSite(payload),
    onSuccess: (result, variables) => {
      // Invalidate brand site queries to refresh
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });

      if (result.updated) {
        toast.success("Site updated successfully!");
      }

      if (result.requiresClarification) {
        toast.info("AI needs clarification - check the chat");
      }
    },
    onError: (error: unknown) => {
      console.error("Failed to process chat request:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to process request: ${errorMessage}`);
    },
  });
};

