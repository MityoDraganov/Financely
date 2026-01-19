import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";

export function useSubmitMarketplaceTemplate() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async (payload: {
      sourceTemplateId: string;
      sourceTemplateType: "invoice" | "email";
      orgId: string;
      title: string;
      description?: string;
      shortDescription?: string;
      category?: string;
      tags?: string[];
      language?: string;
      country?: string;
      previewImages?: string[];
    }) => {
      return functionsService.submitMarketplaceTemplate(payload);
    },
    onSuccess: (result) => {
      // Invalidate queries to refresh submissions list
      // Invalidate all submission queries (with any userId)
      queryClient.invalidateQueries({ 
        queryKey: ["marketplaceTemplates", "submissions"],
        exact: false, // Match all queries starting with this key
      });
      // Also invalidate the specific user's submissions query
      if (user?.id) {
        queryClient.invalidateQueries({ 
          queryKey: ["marketplaceTemplates", "submissions", user.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });

      toast.success(result.message || "Template submitted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to submit template", {
        description: error.message,
      });
    },
  });
}
