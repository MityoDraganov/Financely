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
}

/**
 * Hook to fetch all published marketplace templates with optional filters
 */
export const useMarketplaceTemplates = (params?: UseMarketplaceTemplatesParams) => {
  const { type, search, category, language, sort = "popular" } = params || {};

  return useQuery({
    queryKey: ["marketplaceTemplates", "all", type, search, category, language, sort],
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

      // Fetch templates
      const templates = await marketplaceTemplateRepository.getAll({
        queryConstraints,
        orderBy,
      });

      // Client-side search filtering (for now)
      let filtered = templates;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = templates.filter(
          (template: MarketplaceTemplate) =>
            template.title.toLowerCase().includes(searchLower) ||
            template.description?.toLowerCase().includes(searchLower) ||
            template.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
        );
      }

      // Sort: Featured templates first, then by the selected sort order
      return filtered.sort((a, b) => {
        // Featured templates always come first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // If both have same featured status, maintain original order
        return 0;
      });
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
 * Hook to fetch user's own marketplace submissions (for contributor portal)
 * Returns all submissions including pending, published, rejected, etc.
 */
export const useMyMarketplaceSubmissions = (userId: string | undefined) => {
  return useQuery<MarketplaceTemplate[]>({
    queryKey: ["marketplaceTemplates", "submissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      console.log("Fetching submissions for userId:", userId);
      
      const result = await marketplaceTemplateRepository.getAll({
        queryConstraints: [
          { field: "authorId", operator: "==", value: userId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
      
      console.log("Repository result:", result);
      
      // Handle both array and paginated result
      const submissions = Array.isArray(result) ? result : result.data || [];
      console.log("Processed submissions:", submissions);
      
      return submissions;
    },
    enabled: !!userId,
    staleTime: 0, // Always refetch to get latest data
  });
};
