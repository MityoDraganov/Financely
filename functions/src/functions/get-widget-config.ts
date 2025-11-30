import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import {
	getRateLimiter,
	checkRequestSize,
	extractIpFromRequest,
	normalizeOrganizationId,
} from "../middleware";
import { getConfigCache } from "../middleware/config-cache";

/**
 * Public API endpoint to fetch widget configuration for an organization.
 * This endpoint is used by the embeddable widget script to load configuration dynamically.
 * 
 * GET /getWidgetConfig?organizationId=xxx
 * 
 * Response:
 * {
 *   organizationId: string,
 *   branding: {
 *     logo: string | null,
 *     companyName: string,
 *     colors: { primary: string, secondary: string, accent: string }
 *   },
 *   widgets: {
 *     enabled: boolean,
 *     contactForm: {...} | null,
 *     invoiceRequest: {...} | null,
 *     quoteRequest: {...} | null
 *   }
 * }
 */
export const getWidgetConfig = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request, response) => {
    const FUNCTION_NAME = "get-widget-config";
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
      const cacheKey = `widget-config:${organizationId}`;
      const cached = cache.get<{
        organizationId: string;
        branding: unknown;
        widgets: unknown;
      }>(cacheKey);

      if (cached) {
        logger.debug("Widget config served from cache", { organizationId });
        // Set cache headers
        response.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
        response.setHeader("X-Cache", "HIT");
        response.status(200).json(cached);
        return;
      }

      logger.info("Fetching widget config", { organizationId });

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      const organization = await organizationRepository.get({ id: organizationId });

      if (!organization) {
        response.status(404).json({
          error: "Organization not found",
        });
        return;
      }

      if (organization.status !== "active") {
        response.status(403).json({
          error: "Organization is not active",
        });
        return;
      }

      // Extract widget configuration
      const widgets = organization.settings?.widgets;
      const branding = organization.settings?.branding;
      const brandColors = organization.settings?.brandColors || {
        primary: "#2563eb",
        secondary: "#6b7280",
        accent: "#10b981",
      };

      // Build response with only enabled widgets
      // Styling and localization are now widget-specific (inside each widget's config)
      const config = {
        organizationId: organization.id,
        branding: {
          logo: branding?.customLogo || organization.logoUrl || null,
          companyName: branding?.companyName || organization.name,
          colors: brandColors,
        },
        widgets: widgets?.enabled
          ? {
              enabled: true,
              // Styling and localization are now widget-specific
              contactForm: widgets.contactForm?.enabled ? widgets.contactForm : null,
              invoiceRequest: widgets.invoiceRequest?.enabled ? widgets.invoiceRequest : null,
              quoteRequest: widgets.quoteRequest?.enabled ? widgets.quoteRequest : null,
            }
          : {
              enabled: false,
              contactForm: null,
              invoiceRequest: null,
              quoteRequest: null,
            },
      };

      // Cache the config (5 minutes TTL)
      cache.set(cacheKey, config, 300);

      logger.info("Widget config fetched successfully", { organizationId });

      // Set cache headers
      response.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
      response.setHeader("X-Cache", "MISS");
      response.status(200).json(config);
    } catch (error) {
      logger.error("Error fetching widget config", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: request.query,
      });

      response.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

