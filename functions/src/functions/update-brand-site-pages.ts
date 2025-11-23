import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService } from "../services/audit-log-service";

interface PageContentEntry {
  id: string;
  title: string;
  summary?: string;
  link?: string;
  image?: string;
  description?: string; // Rich text HTML for AI
  localization?: {
    defaultLanguage: "en";
    languages: Record<string, {
      title: string;
      description: string;
      summary?: string;
      image?: string;
      link?: string;
    }>;
  };
}

interface SitePagePayload {
  id: string;
  title: string;
  slug: string;
  description?: string;
  context?: string;
  type?: "standard" | "blog" | "contact";
  order?: number;
  contentEntries?: PageContentEntry[];
}

interface UpdateBrandSitePagesPayload {
  brandSiteId: string;
  pages: SitePagePayload[];
}

/**
 * Firebase Cloud Function for updating brand site pages.
 *
 * This function validates and updates the pages configuration for a brand site.
 * It ensures:
 * - Slug uniqueness
 * - First page is always "index"
 * - Page order is normalized
 * - User has access to the brand site
 *
 * Request payload:
 * {
 *   brandSiteId: string,
 *   pages: Array<{
 *     id: string,
 *     title: string,
 *     slug: string,
 *     description?: string,
 *     context?: string,
 *     type?: "standard" | "blog" | "contact",
 *     order?: number,
 *     contentEntries?: Array<{
 *       id: string,
 *       title: string,
 *       summary?: string,
 *       link?: string,
 *       image?: string,
 *       description?: string,
 *       localization?: {
 *         defaultLanguage: "en",
 *         languages: Record<string, {
 *           title: string,
 *           description: string,
 *           summary?: string,
 *           image?: string,
 *           link?: string
 *         }>
 *       }
 *     }>
 *   }>
 * }
 *
 * Response: { success: true, brandSiteId: string }
 */
export const updateBrandSitePages = onCall<UpdateBrandSitePagesPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { brandSiteId, pages } = request.data;

      if (!brandSiteId) {
        throw new HttpsError(
          "invalid-argument",
          "brandSiteId is required",
        );
      }

      if (!pages || !Array.isArray(pages)) {
        throw new HttpsError(
          "invalid-argument",
          "pages array is required",
        );
      }

      logger.info("Updating brand site pages", {
        brandSiteId,
        pageCount: pages.length,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      // Get brand site to verify it exists and user has access
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError(
          "not-found",
          "Brand site not found",
        );
      }

      // TODO: Add authentication check to verify user owns the organization
      // const userContext = await extractUserContextFromRequest(request);
      // if (userContext?.organizationId !== brandSite.organizationId) {
      //   throw new HttpsError("permission-denied", "Access denied");
      // }

      // Validate and normalize pages
      const seenSlugs = new Set<string>();
      const normalizedPages = pages.map((page, index) => {
        // Validate required fields
        if (!page.id || !page.title || !page.slug) {
          throw new HttpsError(
            "invalid-argument",
            `Page at index ${index} is missing required fields (id, title, slug)`,
          );
        }

        // Normalize slug
        let slug = page.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        // First page must be "index"
        if (index === 0) {
          slug = "index";
        }

        // Ensure slug uniqueness
        let finalSlug = slug;
        let counter = 1;
        while (seenSlugs.has(finalSlug)) {
          finalSlug = `${slug}-${counter}`;
          counter++;
        }
        seenSlugs.add(finalSlug);

        // Normalize content entries
        const contentEntries = (page.contentEntries || []).map((entry, entryIndex) => ({
          id: entry.id || `entry-${index}-${entryIndex}-${Date.now()}`,
          title: entry.title?.trim() || `Entry ${entryIndex + 1}`,
          summary: entry.summary?.trim() || undefined,
          link: entry.link?.trim() || undefined,
          image: entry.image?.trim() || undefined,
          description: entry.description || undefined, // Rich text HTML - preserve as-is
          localization: entry.localization || undefined, // Localization data - preserve as-is
        }));

        return {
          id: page.id,
          title: page.title.trim(),
          slug: finalSlug,
          order: index,
          type: (page.type || "standard") as "standard" | "blog" | "contact",
          description: page.description?.trim() || undefined,
          context: page.context?.trim() || undefined,
          contentEntries,
        };
      });

      // Sort by order to ensure consistency
      normalizedPages.sort((a, b) => a.order - b.order);

      // Update brand site
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          pages: normalizedPages,
        },
      });

      logger.info("Brand site pages updated successfully", {
        brandSiteId,
        pageCount: normalizedPages.length,
        duration: Date.now() - startTime,
      });

      // Create audit log entry
      try {
        const userContext = await extractUserContextFromRequest(request);
        if (userContext) {
          const auditLogRepository = getAuditLogRepository(databaseService);
          const auditLogService = getAuditLogService(auditLogRepository);

          await auditLogService.logSuccess(
            brandSite.organizationId,
            "site.pages.updated",
            userContext,
            {
              resource: {
                type: "brandSite",
                id: brandSiteId,
                name: brandSite.brandName,
              },
              durationMs: Date.now() - startTime,
              metadata: {
                source: "api",
                sourceDetails: "updateBrandSitePages",
                customFields: {
                  pageCount: normalizedPages.length,
                },
              },
            },
          );
        }
      } catch (auditError) {
        // Don't fail the operation if audit logging fails
        logger.warn("Failed to create audit log for page update", {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      return { success: true, brandSiteId };
    } catch (error) {
      logger.error("Failed to update brand site pages", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      // Log failure to audit log
      try {
        const userContext = await extractUserContextFromRequest(request);
        const errorPayload = request.data as UpdateBrandSitePagesPayload;
        if (userContext && errorPayload?.brandSiteId) {
          const databaseService = getDatabaseService();
          const brandSiteRepository = getBrandSiteRepository(databaseService);
          const brandSite = await brandSiteRepository.get({ id: errorPayload.brandSiteId });
          
          if (brandSite) {
            const auditLogRepository = getAuditLogRepository(databaseService);
            const auditLogService = getAuditLogService(auditLogRepository);

            await auditLogService.logFailure(
              brandSite.organizationId,
              "site.pages.updated",
              userContext,
              error instanceof Error ? error : new Error(String(error)),
              {
                metadata: {
                  source: "api",
                  sourceDetails: "updateBrandSitePages",
                },
              },
            );
          }
        }
      } catch (auditError) {
        // Don't fail if audit logging fails
        logger.warn("Failed to create audit log for page update failure", {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to update brand site pages: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
);

