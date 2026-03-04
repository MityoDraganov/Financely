import { MarketplaceTemplateVersion, QueryConstraint } from "@/core";
import { getMarketplaceTemplateVersionRepository } from "@/repositories/marketplace-template-version-repository";
import { serviceHost } from "@/services";
import { useQuery } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const marketplaceTemplateVersionRepository = getMarketplaceTemplateVersionRepository(databaseService);

export const useMarketplaceTemplateVersions = (marketplaceTemplateId: string | undefined) => {
  return useQuery<MarketplaceTemplateVersion[]>({
    queryKey: ["marketplaceTemplateVersions", marketplaceTemplateId],
    queryFn: async () => {
      if (!marketplaceTemplateId) return [];

      const queryConstraints: QueryConstraint[] = [
        { field: "marketplaceTemplateId", operator: "==", value: marketplaceTemplateId },
      ];

      return marketplaceTemplateVersionRepository.getAll({
        queryConstraints,
        orderBy: { field: "version", direction: "desc" },
      });
    },
    enabled: !!marketplaceTemplateId,
  });
};
