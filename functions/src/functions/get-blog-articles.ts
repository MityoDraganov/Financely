import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";

interface GetBlogArticlesPayload {
  brandSiteId: string;
  pageSlug: string;
}

/**
 * Firebase Cloud Function to fetch blog articles for a specific blog page.
 * 
 * This function returns articles dynamically so they can be loaded client-side
 * without requiring site regeneration.
 * 
 * Request payload:
 * {
 *   brandSiteId: string,
 *   pageSlug: string
 * }
 * 
 * Response: {
 *   articles: Array<{
 *     id: string,
 *     title: string,
 *     summary?: string,
 *     link?: string,
 *     image?: string,
 *     description?: string,
 *     localization?: {
 *       defaultLanguage: "en",
 *       languages: Record<string, {
 *         title: string,
 *         description: string,
 *         summary?: string,
 *         image?: string,
 *         link?: string
 *       }>
 *     }
 *   }>
 * }
 */
export const getBlogArticles = onCall<GetBlogArticlesPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const { brandSiteId, pageSlug } = request.data;

      if (!brandSiteId) {
        throw new HttpsError(
          "invalid-argument",
          "brandSiteId is required",
        );
      }

      if (!pageSlug) {
        throw new HttpsError(
          "invalid-argument",
          "pageSlug is required",
        );
      }

      logger.info("Fetching blog articles", {
        brandSiteId,
        pageSlug,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      // Get brand site
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError(
          "not-found",
          "Brand site not found",
        );
      }

      // Find the blog page by slug
      const pages = (brandSite.pages as any[]) || [];
      const blogPage = pages.find(
        (page) => page.slug === pageSlug && page.type === "blog"
      );

      if (!blogPage) {
        // Return empty array if page not found or not a blog page
        return { articles: [] };
      }

      // Extract articles from contentEntries
      const articles = (blogPage.contentEntries || []).map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        link: entry.link,
        image: entry.image,
        description: entry.description,
        localization: entry.localization,
      }));

      logger.info("Returning blog articles", {
        brandSiteId,
        pageSlug,
        articleCount: articles.length,
      });

      return { articles };
    } catch (error) {
      logger.error("Failed to fetch blog articles", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to fetch blog articles",
      );
    }
  }
);

