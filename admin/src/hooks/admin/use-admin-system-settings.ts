import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";
import { toast } from "sonner";

interface SystemSettings {
  pricing: {
    starter: { monthly: number; yearly: number };
    professional: { monthly: number; yearly: number };
    enterprise: { monthly: number; yearly: number };
  };
  featureToggles: {
    allowSignups: boolean;
    maintenanceMode: boolean;
    apiAccess: boolean;
    customTemplates: boolean;
    emailSending: boolean;
    pdfGeneration: boolean;
  };
  globalLimits: {
    maxOrganizations: number;
    maxUsersPerOrg: number;
    maxInvoicesPerOrg: number;
    maxTemplatesPerOrg: number;
    maxStoragePerOrgMB: number;
  };
}

/**
 * Hook to fetch system settings
 */
export function useAdminSystemSettings() {
  return useQuery<SystemSettings | null>({
    queryKey: ["admin", "system-settings"],
    queryFn: async () => {
      const functions = getFunctions(firebase.app);
      const getSettings = httpsCallable<{}, SystemSettings | null>(
        functions,
        "adminGetSystemSettings"
      );
      const result = await getSettings();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update system settings
 */
export function useAdminUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<SystemSettings>) => {
      const functions = getFunctions(firebase.app);
      const updateSettings = httpsCallable<
        { settings: Partial<SystemSettings> },
        { success: boolean }
      >(functions, "adminUpdateSystemSettings");
      const result = await updateSettings({ settings });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "system-settings"] });
      toast.success("System settings updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });
}

