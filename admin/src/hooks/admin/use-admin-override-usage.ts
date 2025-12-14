import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { toast } from "sonner";

interface OverrideUsageRequest {
  organizationId: string;
  usageOverrides: {
    templateCount?: number;
    invoiceCount?: number;
    memberCount?: number;
    storageBytes?: number;
  };
}

/**
 * Hook to override organization usage (superadmin only)
 */
export function useAdminOverrideUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: OverrideUsageRequest) => {
      const functions = getFunctions(firebase.app);
      const overrideUsage = httpsCallable<OverrideUsageRequest, { success: boolean; organizationId: string }>(
        functions,
        "adminOverrideUsage"
      );
      const result = await overrideUsage(request);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations", data.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations", data.organizationId, "usage"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations", "all"] });
      toast.success("Usage overridden successfully");
    },
    onError: (error) => {
      toast.error(`Failed to override usage: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });
}

