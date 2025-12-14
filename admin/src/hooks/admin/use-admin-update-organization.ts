import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { toast } from "sonner";

interface UpdateOrganizationRequest {
  organizationId: string;
  updates: {
    name?: string;
    description?: string;
    status?: "active" | "suspended" | "deleted";
    settings?: Record<string, unknown>;
  };
}

/**
 * Hook to update an organization (admin only)
 */
export function useAdminUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateOrganizationRequest) => {
      const functions = getFunctions(firebase.app);
      const updateOrg = httpsCallable<UpdateOrganizationRequest, { success: boolean; organizationId: string }>(
        functions,
        "adminUpdateOrganization"
      );
      const result = await updateOrg(request);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations", data.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations", "all"] });
      toast.success("Organization updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update organization: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });
}

