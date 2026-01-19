import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

export function useRegisterContributor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { termsAccepted: boolean }) => {
      return functionsService.registerAsContributor(payload);
    },
    onSuccess: (result) => {
      // Invalidate the user's contributor status
      queryClient.invalidateQueries({ queryKey: ["user", "isContributor"] });

      toast.success(result.message || "Registered as contributor successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to register as contributor", {
        description: error.message,
      });
    },
  });
}
