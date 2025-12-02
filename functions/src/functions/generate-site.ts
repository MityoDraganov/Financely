import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleGenerateSiteInit } from "../app/handle-generate-site-init";
import { logger } from "firebase-functions";

interface SitePagePayload {
  id: string;
  title: string;
  slug: string;
  description?: string;
  context?: string;
  type?: "standard" | "blog" | "contact";
  order?: number;
}

interface GenerateSitePayload {
  organizationId: string;
  brandName?: string;
  tone?: string;
  context?: string;
  contextImages?: string[];
  pages?: SitePagePayload[];
}

/**
 * Firebase Cloud Function for initiating AI-powered brand site generation.
 *
 * This function returns immediately after creating the brand site document.
 * The actual generation (AI, deployment, DNS) is processed asynchronously
 * by a Firestore trigger.
 *
 * Request payload:
 * {
 *   organizationId: string,
 *   brandName?: string,
 *   tone?: string
 * }
 *
 * Response: { id: string, status: "pending" }
 *
 * The frontend should poll the brand site document to check status updates.
 */
export const generateSite = onCall<GenerateSitePayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60, // Fast response - just creates document
    memory: "256MiB",
  },
  async (request) => {
    try {
      const { organizationId, brandName, tone, context, contextImages, pages } = request.data;

      if (!organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "organizationId is required",
        );
      }

      logger.info("Initiating site generation", {
        organizationId,
        brandName,
        tone,
        hasContext: !!context,
        contextImageCount: contextImages?.length || 0,
        pageCount: pages?.length || 0,
      });

      // This returns immediately after creating the document
      const result = await handleGenerateSiteInit({
        organizationId,
        brandName,
        tone,
        context,
        contextImages,
        pages,
      });

      logger.info("Site generation initiated", {
        brandSiteId: result.id,
        status: result.status,
      });

      // Record usage event for site generation initiation
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        const { extractUserContextFromRequest } = await import("../utils/request-context");
        
        const userContext = await extractUserContextFromRequest(request);
        
        await recordUsageEvent({
          orgId: organizationId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.AI_SITE_BUILDER_GENERATE,
          metadata: {
            entityId: result.id,
            context: "api",
            payloadType: "site",
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        logger.warn("Failed to record usage event for site generation initiation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      return result;
    } catch (error) {
      logger.error("Error initiating site generation", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to initiate site generation",
      );
    }
  },
);

