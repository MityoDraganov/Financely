import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { Organization } from "@/core";

interface BillingSettings {
  autoRenew?: boolean;
  usageAlerts?: boolean;
  usageAlertThresholds?: {
    warning: number;
    critical: number;
  };
  billingEmail?: string;
}

/**
 * Hook to update billing settings
 */
export function useUpdateBillingSettings() {
  const updateOrganization = useUpdateOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      settings,
    }: {
      organizationId: string;
      settings: BillingSettings;
    }) => {
      // Get current organization to merge settings
      const { repositoryHost } = await import("@/repositories");
      const { serviceHost } = await import("@/services");
      const databaseService = serviceHost.getDatabaseService();
      const organizationRepository = repositoryHost.getOrganizationsRepository(databaseService);

      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new Error("Organization not found");
      }

      // Merge billing settings
      const currentBilling = organization.settings?.billing || {};
      const updatedBilling = {
        ...currentBilling,
        ...settings,
        usageAlertThresholds: settings.usageAlertThresholds
          ? {
              ...currentBilling?.usageAlertThresholds,
              ...settings.usageAlertThresholds,
            }
          : currentBilling?.usageAlertThresholds,
      };

      return updateOrganization.mutateAsync({
        id: organizationId,
        data: {
          settings: {
            ...organization.settings,
            billing: updatedBilling,
          },
        } as Partial<Organization>,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", variables.organizationId] });
    },
  });
}

