import { MarketplaceTemplate, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const marketplaceTemplateRepository = repositoryHost.getMarketplaceTemplatesRepository(databaseService);

export interface UseMarketplaceTemplatesParams {
  type?: "invoice" | "email";
  search?: string;
  category?: string;
  language?: string;
  sort?: "popular" | "newest" | "rating";
  page?: number;
  pageSize?: number;
}

export interface MarketplaceTemplatesResponse {
  templates: MarketplaceTemplate[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Hook to fetch all published marketplace templates with optional filters and pagination
 */
export const useMarketplaceTemplates = (params?: UseMarketplaceTemplatesParams) => {
  const { 
    type, 
    search, 
    category, 
    language, 
    sort = "popular",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE
  } = params || {};

  return useQuery<MarketplaceTemplatesResponse>({
    queryKey: ["marketplaceTemplates", "all", type, search, category, language, sort, page, pageSize],
    queryFn: async () => {
      // Build query constraints
      const queryConstraints: QueryConstraint[] = [
        { field: "status", operator: "==", value: "published" },
      ];

      if (type) {
        queryConstraints.push({ field: "type", operator: "==", value: type });
      }

      if (category) {
        queryConstraints.push({ field: "category", operator: "==", value: category });
      }

      if (language) {
        queryConstraints.push({ field: "language", operator: "==", value: language });
      }

      // Determine order by based on sort
      let orderBy: { field: string; direction: "asc" | "desc" } | undefined;
      if (sort === "popular") {
        orderBy = { field: "downloadCount", direction: "desc" };
      } else if (sort === "newest") {
        orderBy = { field: "publishedAt", direction: "desc" };
      } else if (sort === "rating") {
        orderBy = { field: "ratingAverage", direction: "desc" };
      }

      // Calculate pagination offset
      const skip = (page - 1) * pageSize;

      // Fetch templates with pagination
      // Note: Firestore pagination uses cursor-based pagination, but for simplicity
      // we'll fetch all matching templates and paginate client-side after filtering
      // This works for moderate dataset sizes
      const allTemplates = await marketplaceTemplateRepository.getAll({
        queryConstraints,
        orderBy,
      });

      // Client-side search filtering
      let filtered = allTemplates;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = allTemplates.filter(
          (template: MarketplaceTemplate) =>
            template.title.toLowerCase().includes(searchLower) ||
            template.description?.toLowerCase().includes(searchLower) ||
            (template.tags && template.tags.some((tag: string) => tag.toLowerCase().includes(searchLower)))
        );
      }

      // Sort: Featured templates first, then by the selected sort order
      const sorted = filtered.sort((a, b) => {
        // Featured templates always come first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // If both have same featured status, maintain original order
        return 0;
      });

      // Apply pagination
      const startIndex = skip;
      const endIndex = startIndex + pageSize;
      const paginatedTemplates = sorted.slice(startIndex, endIndex);
      const hasNextPage = sorted.length > endIndex;
      const hasPreviousPage = page > 1;

      return {
        templates: paginatedTemplates,
        hasNextPage,
        hasPreviousPage,
        currentPage: page,
        pageSize,
      };
    },
  });
};

/**
 * Hook to fetch a single marketplace template by ID
 */
export const useMarketplaceTemplate = (templateId: string | undefined) => {
  return useQuery({
    queryKey: ["marketplaceTemplates", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      return marketplaceTemplateRepository.get({ id: templateId });
    },
    enabled: !!templateId,
  });
};

/**
 * Hook to fetch organization-owned marketplace submissions (for contributor portal)
 * Returns all submissions including pending, published, rejected, etc.
 * Polls every 3s while any submission has a non-terminal AI enrichment status.
 */
export const useMyMarketplaceSubmissions = (organizationId: string | undefined) => {
  return useQuery<MarketplaceTemplate[]>({
    queryKey: ["marketplaceTemplates", "submissions", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const [ownedByOrganization, legacyOwnedBySourceOrg] = await Promise.all([
        marketplaceTemplateRepository.getAll({
          queryConstraints: [
            { field: "organizationId", operator: "==", value: organizationId },
          ],
          orderBy: { field: "createdAt", direction: "desc" },
        }),
        marketplaceTemplateRepository.getAll({
          queryConstraints: [
            { field: "sourceOrgId", operator: "==", value: organizationId },
          ],
          orderBy: { field: "createdAt", direction: "desc" },
        }),
      ]);

      const normalize = (result: unknown): MarketplaceTemplate[] =>
        Array.isArray(result)
          ? result
          : (result as { data?: MarketplaceTemplate[] })?.data || [];

      const merged = [...normalize(ownedByOrganization), ...normalize(legacyOwnedBySourceOrg)];
      const uniqueById = new Map<string, MarketplaceTemplate>();
      merged.forEach((template) => {
        if (!uniqueById.has(template.id)) {
          uniqueById.set(template.id, template);
        }
      });

      return Array.from(uniqueById.values()).sort((left, right) => {
        const leftCreated = Date.parse(left.createdAt || "");
        const rightCreated = Date.parse(right.createdAt || "");
        return (Number.isNaN(rightCreated) ? 0 : rightCreated) - (Number.isNaN(leftCreated) ? 0 : leftCreated);
      });
    },
    enabled: !!organizationId,
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.some(
        (t) => t.aiEnrichmentStatus === "pending" || t.aiEnrichmentStatus === "processing",
      );
      return hasActive ? 3000 : false;
    },
  });
};
