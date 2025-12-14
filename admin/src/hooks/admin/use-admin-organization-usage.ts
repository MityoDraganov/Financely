import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

export interface OrganizationUsage {
  invoices: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    cancelled: number;
  };
  templates: {
    total: number;
    active: number;
  };
  storage: {
    bytes: number;
    mb: number;
  };
}

/**
 * Admin hook to fetch organization usage statistics
 */
export function useAdminOrganizationUsage(organizationId: string | undefined) {
  return useQuery<OrganizationUsage>({
    queryKey: ["admin", "organizations", organizationId, "usage"],
    queryFn: async () => {
      if (!organizationId) {
        return {
          invoices: { total: 0, draft: 0, sent: 0, paid: 0, cancelled: 0 },
          templates: { total: 0, active: 0 },
          storage: { bytes: 0, mb: 0 },
        };
      }

      // Fetch invoices for this organization
      const invoices = await invoiceRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: organizationId }],
        pagination: { limit: 10000 },
      });

      // Fetch templates for this organization
      const templates = await templateRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: organizationId }],
        pagination: { limit: 10000 },
      });

      // Calculate invoice stats
      const invoiceStats = {
        total: invoices.length,
        draft: invoices.filter((inv) => inv.status === "draft").length,
        sent: invoices.filter((inv) => inv.status === "sent").length,
        paid: invoices.filter((inv) => inv.status === "paid").length,
        cancelled: invoices.filter((inv) => inv.status === "cancelled").length,
      };

      // Calculate template stats
      const templateStats = {
        total: templates.length,
        active: templates.length, // All templates are active (no deleted field in schema)
      };

      // Get storage from organization usage field if available
      // For now, we'll estimate or fetch from org data
      const storageBytes = 0; // TODO: Calculate from actual storage usage
      const storageMB = Math.round((storageBytes / 1024 / 1024) * 100) / 100;

      return {
        invoices: invoiceStats,
        templates: templateStats,
        storage: {
          bytes: storageBytes,
          mb: storageMB,
        },
      };
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
  });
}

