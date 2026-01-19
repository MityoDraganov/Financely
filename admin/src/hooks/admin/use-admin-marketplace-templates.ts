import { useQuery } from "@tanstack/react-query";
import { MarketplaceTemplate, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const marketplaceTemplateRepository = repositoryHost.getMarketplaceTemplateRepository(databaseService);

/**
 * Admin hook to fetch marketplace templates
 * Uses repository directly - admin Firestore rules should allow this
 * Follows the same pattern as use-admin-organizations.ts
 */
export function useAdminMarketplaceTemplates(status?: "published" | "draft" | "unpublished") {
  const queryConstraints: QueryConstraint[] = status
    ? [{ field: "status", operator: "==", value: status }]
    : [{ field: "status", operator: "==", value: "published" }]; // Default to published

  return useQuery<MarketplaceTemplate[]>({
    queryKey: ["admin", "marketplace", "templates", status || "published"],
    queryFn: async () => {
      const result = await marketplaceTemplateRepository.getAll({
        queryConstraints,
        pagination: { limit: 1000 }, // Get all templates
        orderBy: { field: "createdAt", direction: "desc" },
      });
      // getAll returns T[] directly
      return Array.isArray(result) ? result : result.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
