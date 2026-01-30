import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Hook to delete a brand site
 */
export const useDeleteBrandSite = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: Parameters<typeof functionsService.deleteBrandSite>[0]) =>
      functionsService.deleteBrandSite(payload),
    onSuccess: (_result, variables) => {
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: ["brandSites"],
      });
      queryClient.invalidateQueries({
        queryKey: ["brandSite", variables.brandSiteId],
      });
      
      toast.success("Website deleted successfully");
      
      // Navigate away from the site builder page
      navigate("/dashboard");
    },
    onError: (error: unknown) => {
      console.error("Failed to delete brand site:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete website: ${errorMessage}`);
    },
  });
};

