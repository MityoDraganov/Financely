import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getAnalyticsEventRepository } from "../repositories/analytics-event-repository";
import { getAnalyticsConfigRepository } from "../repositories/analytics-config-repository";
import {
	getRateLimiter,
	checkRequestSize,
	extractIpFromRequest,
	normalizeOrganizationId,
	validateEventName,
	validateAnalyticsProperties,
	truncateString,
	MAX_LENGTHS,
} from "../middleware";
import { shouldSampleEvent } from "../middleware/abuse-protection";

/**
 * Firebase Cloud Function to store analytics events in Firestore
 * Called by analytics-loader.js to store events for real-time analytics
 * Uses onRequest for direct HTTP access from static sites
 */
export const storeAnalyticsEvent = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
    timeoutSeconds: 10,
    memory: "256MiB",
  },
  async (req, res) => {
    const FUNCTION_NAME = "store-analytics-event";
    const ipAddress = extractIpFromRequest(req);

    try {
      // Only allow POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Request size check (early, before processing)
      const sizeCheck = checkRequestSize(req, FUNCTION_NAME);
      if (!sizeCheck.isValid) {
        res.status(400).json({
          error: sizeCheck.error || "Request too large",
        });
        return;
      }

      // Extract and validate orgId
      const rawOrgId = req.body?.orgId;
      const orgId = normalizeOrganizationId(rawOrgId);
      if (!orgId) {
        res.status(400).json({ error: "orgId is required and must be a valid identifier" });
        return;
      }

      // Rate limiting check
      const rateLimiter = getRateLimiter();
      const rateLimitResult = await rateLimiter.checkLimit(
        FUNCTION_NAME,
        ipAddress,
        orgId
      );

      rateLimiter.logRateLimitEvent(
        FUNCTION_NAME,
        rateLimitResult,
        ipAddress,
        orgId
      );

      // If rate limit exceeded, sample events instead of hard-failing
      // This protects Firestore from excessive writes while still allowing some events through
      if (!rateLimitResult.allowed) {
        const sampleRate = 0.1; // Keep 10% of events when limit exceeded
        if (shouldSampleEvent(orgId, sampleRate)) {
          // Drop this event silently
          logger.debug("Analytics event dropped due to rate limit", {
            orgId,
            ipHash: ipAddress ? "present" : undefined,
          });
          res.status(200).json({ success: true }); // Return success to avoid client retries
          return;
        }
        // Otherwise, allow this event through (sampled)
        logger.info("Analytics event sampled (rate limit exceeded)", {
          orgId,
          ipHash: ipAddress ? "present" : undefined,
        });
      }

      // Validate public write token (if configured)
      const databaseService = getDatabaseService();
      const analyticsConfigRepository = getAnalyticsConfigRepository(databaseService);
      const analyticsConfig = await analyticsConfigRepository.get(orgId);

      if (analyticsConfig?.publicWriteToken) {
        // Token can be in header or query parameter
        const providedToken =
          req.headers["x-analytics-token"] ||
          (req.query.token as string) ||
          req.body?.token;

        if (!providedToken || providedToken !== analyticsConfig.publicWriteToken) {
          logger.warn("Invalid or missing analytics write token", {
            orgId,
            ipHash: ipAddress ? "present" : undefined,
          });
          res.status(403).json({ error: "Invalid or missing write token" });
          return;
        }
      }

      // Validate event name
      const rawEvent = req.body?.event;
      const event = validateEventName(rawEvent);
      if (!event) {
        res.status(400).json({
          error: "event is required and must be a valid event name",
        });
        return;
      }

      // Extract and validate other parameters
      const {
        siteId: rawSiteId,
        brandName: rawBrandName,
        pagePath: rawPagePath,
        pageTitle: rawPageTitle,
        referrer: rawReferrer,
        clientId: rawClientId,
        userAgent: rawUserAgent,
        ...otherParams
      } = req.body;

      // Normalize and truncate string fields
      const siteId = rawSiteId
        ? truncateString(rawSiteId, MAX_LENGTHS.siteId, "")
        : null;
      const brandName = rawBrandName
        ? truncateString(rawBrandName, MAX_LENGTHS.brandName, "")
        : null;
      const pagePath = rawPagePath
        ? truncateString(rawPagePath, MAX_LENGTHS.pagePath, "")
        : null;
      const pageTitle = rawPageTitle
        ? truncateString(rawPageTitle, MAX_LENGTHS.pageTitle, "")
        : null;
      const referrer = rawReferrer
        ? truncateString(rawReferrer, MAX_LENGTHS.referrer, "")
        : null;
      const clientId = rawClientId
        ? truncateString(rawClientId, MAX_LENGTHS.clientId, "")
        : null;
      const userAgent = rawUserAgent
        ? truncateString(rawUserAgent, MAX_LENGTHS.userAgent, "")
        : null;

      // Validate and normalize other parameters (properties)
      const validatedOtherParams = validateAnalyticsProperties(otherParams);
      if (validatedOtherParams === null) {
        res.status(400).json({
          error: "Invalid event properties (too many keys or invalid values)",
        });
        return;
      }

      const analyticsEventRepository = getAnalyticsEventRepository(databaseService);

      const eventData = {
        org_id: orgId,
        site_id: siteId,
        brand_name: brandName,
        event,
        page_path: pagePath,
        page_title: pageTitle,
        referrer,
        client_id: clientId,
        user_agent: userAgent,
        ...validatedOtherParams,
      };

      await analyticsEventRepository.create(orgId, eventData);

      logger.debug("Analytics event stored", {
        orgId,
        event,
        siteId,
      });

      // Record usage event
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId,
          userId: null, // Analytics events are from external users
          featureId: USAGE_FEATURES.WIDGET_ANALYTICS_EVENT,
          metadata: {
            context: "widget",
            ...(siteId && { entityId: siteId }),
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage event for analytics event", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error storing analytics event", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: req.body,
      });

      res.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

