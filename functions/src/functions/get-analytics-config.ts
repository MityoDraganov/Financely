import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getAnalyticsConfigRepository } from "../repositories/analytics-config-repository";
import {
	getRateLimiter,
	checkRequestSize,
	extractIpFromRequest,
	normalizeOrganizationId,
} from "../middleware";
import { getConfigCache } from "../middleware/config-cache";

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
    const FUNCTION_NAME = "get-analytics-config";
    const ipAddress = extractIpFromRequest(request);

    try {
      // Only allow GET
      if (request.method !== "GET") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Request size check (for query params)
      const sizeCheck = checkRequestSize(request, FUNCTION_NAME);
      if (!sizeCheck.isValid) {
        response.status(400).json({
          error: sizeCheck.error || "Request too large",
        });
        return;
      }

      // Validate and normalize organizationId
      const rawOrgId = request.query.organizationId;
      const organizationId = normalizeOrganizationId(
        typeof rawOrgId === "string" ? rawOrgId : undefined
      );

      if (!organizationId) {
        response.status(400).json({
          error: "organizationId query parameter is required and must be a valid identifier",
        });
        return;
      }

      // Rate limiting check
      const rateLimiter = getRateLimiter();
      const rateLimitResult = await rateLimiter.checkLimit(
        FUNCTION_NAME,
        ipAddress,
        organizationId
      );

      rateLimiter.logRateLimitEvent(
        FUNCTION_NAME,
        rateLimitResult,
        ipAddress,
        organizationId
      );

      if (!rateLimitResult.allowed) {
        response.status(429).json({
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.resetIn,
        });
        return;
      }

      // Check cache first
      const cache = getConfigCache();
      const cacheKey = `analytics-config:${organizationId}`;
      const cached = cache.get<{
        organizationId: string;
        enabled: boolean;
        [key: string]: unknown;
      }>(cacheKey);

      if (cached) {
        logger.debug("Analytics config served from cache", { organizationId });
        // Set cache headers
        response.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
        response.setHeader("X-Cache", "HIT");
        response.status(200).json(cached);
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
      // Note: Do not expose publicWriteToken in the response
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

      // Cache the config (5 minutes TTL)
      cache.set(cacheKey, config, 300);

      logger.info("Analytics config fetched successfully", { organizationId });

      // Set cache headers
      response.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
      response.setHeader("X-Cache", "MISS");
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

