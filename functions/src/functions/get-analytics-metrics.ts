import { onCall } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { AnalyticsService } from "../services/analytics-service";
import { getDatabaseService } from "../services/database-service";
import { getAnalyticsConfigRepository } from "../repositories/analytics-config-repository";

interface GetAnalyticsMetricsPayload {
  orgId: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Firebase Cloud Function to fetch real analytics metrics
 */
export const getAnalyticsMetrics = onCall<GetAnalyticsMetricsPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    try {
      const { orgId, startDate, endDate } = request.data;

      if (!orgId) {
        throw new HttpsError("invalid-argument", "orgId is required");
      }

      // Default to last 30 days
      const end = endDate || new Date().toISOString().split("T")[0];
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      logger.info("Fetching analytics metrics", {
        orgId,
        startDate: start,
        endDate: end,
      });

      const databaseService = getDatabaseService();
      const analyticsConfigRepo = getAnalyticsConfigRepository(databaseService);
      const analyticsConfig = await analyticsConfigRepo.get(orgId);

      if (!analyticsConfig || !analyticsConfig.enabled) {
        throw new HttpsError("failed-precondition", "Analytics is not enabled for this organization");
      }

      const analyticsService = new AnalyticsService();

      logger.info("Analytics config retrieved", {
        orgId,
        enabled: analyticsConfig.enabled,
        siteId: analyticsConfig.siteId || "none",
        hasGA4: !!analyticsConfig.ga4MeasurementId,
      });

      // Try to get metrics from stored events first (real-time data)
      // If siteId is not set, query all events for the org
      const storedMetrics = await analyticsService.getStoredAnalyticsEvents(
        orgId,
        analyticsConfig.siteId || undefined,
        start,
        end,
      );

      // If we got metrics (even if empty), return them
      // Empty metrics are valid - it means no events in the date range
      if (storedMetrics) {
        logger.info("Returning stored analytics metrics", {
          orgId,
          pageViews: storedMetrics.pageViews,
          visitors: storedMetrics.visitors,
          hasData: storedMetrics.pageViews > 0 || storedMetrics.visitors > 0,
        });
        return storedMetrics;
      }

      // If no stored events, try GA4 API (requires credentials)
      if (analyticsConfig.ga4MeasurementId) {
        const ga4Metrics = await analyticsService.getGA4Metrics({
          propertyId: analyticsConfig.ga4MeasurementId,
          startDate: start,
          endDate: end,
          orgId,
        });

        if (ga4Metrics) {
          return ga4Metrics;
        }
      }

      // Return empty metrics if no data available
      return {
        pageViews: 0,
        visitors: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        topPages: [],
        trafficSources: [],
        devices: [],
        browsers: [],
        referrers: [],
        pageViewsOverTime: [],
        dateRange: { start, end },
      };
    } catch (error) {
      logger.error("Error fetching analytics metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to fetch analytics metrics",
      );
    }
  },
);

