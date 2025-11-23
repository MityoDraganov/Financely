import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getAnalyticsConfigRepository } from "../repositories/analytics-config-repository";

/**
 * Public API endpoint to fetch analytics configuration for an organization.
 * This endpoint is used by the embeddable analytics script to load configuration dynamically.
 * 
 * GET /getAnalyticsConfig?organizationId=xxx
 * 
 * Response:
 * {
 *   organizationId: string,
 *   enabled: boolean,
 *   enableGA4: boolean,
 *   enablePlausible: boolean,
 *   enableUmami: boolean,
 *   enableClarity: boolean,
 *   ga4MeasurementId: string | null,
 *   clarityProjectId: string | null,
 *   plausibleDomain: string | null,
 *   umamiScriptUrl: string | null,
 *   umamiWebsiteId: string | null,
 *   consentDefault: 'granted' | 'denied',
 *   bannerProvider: 'custom' | 'osano' | 'cookiebot',
 *   consentBannerStyling: {...} | null,
 *   strategy: string | null, // Legacy field
 *   siteId: string | null,
 *   brandName: string | null,
 *   firebaseProjectId: string | null,
 *   functionUrl: string | null,
 * }
 */
export const getAnalyticsConfig = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request, response) => {
    try {
      const organizationId = request.query.organizationId as string;

      if (!organizationId || typeof organizationId !== "string") {
        response.status(400).json({
          error: "organizationId query parameter is required",
        });
        return;
      }

      logger.info("Fetching analytics config", { organizationId });

      const databaseService = getDatabaseService();
      const analyticsConfigRepository = getAnalyticsConfigRepository(databaseService);

      const analyticsConfig = await analyticsConfigRepository.get(organizationId);

      if (!analyticsConfig) {
        response.status(404).json({
          error: "Analytics configuration not found",
        });
        return;
      }

      // Get Firebase project ID from environment
      const firebaseProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || null;
      
      // Construct function URL from project ID
      const functionUrl = firebaseProjectId
        ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/storeAnalyticsEvent`
        : null;

      // Build response with analytics configuration
      const config = {
        organizationId: analyticsConfig.orgId,
        enabled: analyticsConfig.enabled ?? false,
        enableGA4: analyticsConfig.enableGA4 ?? false,
        enablePlausible: analyticsConfig.enablePlausible ?? false,
        enableUmami: analyticsConfig.enableUmami ?? false,
        enableClarity: analyticsConfig.enableClarity ?? false,
        ga4MeasurementId: analyticsConfig.ga4MeasurementId || null,
        clarityProjectId: analyticsConfig.clarityProjectId || null,
        plausibleDomain: analyticsConfig.plausibleDomain || null,
        umamiScriptUrl: analyticsConfig.umamiScriptUrl || null,
        umamiWebsiteId: analyticsConfig.umamiWebsiteId || null,
        consentDefault: analyticsConfig.consentDefault || "denied",
        bannerProvider: analyticsConfig.bannerProvider || "custom",
        consentBannerStyling: analyticsConfig.consentBannerStyling || null,
        strategy: analyticsConfig.strategy || null, // Legacy field
        siteId: analyticsConfig.siteId || null,
        brandName: analyticsConfig.brandName || null,
        firebaseProjectId,
        functionUrl,
      };

      logger.info("Analytics config fetched successfully", { organizationId });

      response.status(200).json(config);
    } catch (error) {
      logger.error("Error fetching analytics config", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: request.query,
      });

      response.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

