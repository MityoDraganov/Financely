import { onCall } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { AnalyticsMetrics, AnalyticsService } from "../services/analytics-service";
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
        enableGA4: analyticsConfig.enableGA4,
        enablePlausible: analyticsConfig.enablePlausible,
        enableUmami: analyticsConfig.enableUmami,
        enableClarity: analyticsConfig.enableClarity,
      });

      // Collect metrics from all enabled providers in parallel
      const metricsPromises: Array<{
        source: "firestore" | "ga4" | "plausible" | "umami" | "clarity";
        metrics: Promise<AnalyticsMetrics | null>;
      }> = [];

      // Always try Firestore first (real-time data from our own tracking)
      metricsPromises.push({
        source: "firestore",
        metrics: analyticsService.getStoredAnalyticsEvents(
          orgId,
          analyticsConfig.siteId || undefined,
          start,
          end,
        ),
      });

      // Fetch from GA4 if enabled
      if (analyticsConfig.enableGA4 && analyticsConfig.ga4MeasurementId) {
        metricsPromises.push({
          source: "ga4",
          metrics: analyticsService.getGA4Metrics({
            propertyId: analyticsConfig.ga4MeasurementId,
            startDate: start,
            endDate: end,
            orgId,
          }),
        });
      }

      // Fetch from Plausible if enabled
      if (analyticsConfig.enablePlausible && analyticsConfig.plausibleDomain) {
        metricsPromises.push({
          source: "plausible",
          metrics: analyticsService.getPlausibleMetrics({
            domain: analyticsConfig.plausibleDomain,
            startDate: start,
            endDate: end,
            // Note: API key would need to be stored in config if required
          }),
        });
      }

      // Fetch from Umami if enabled
      if (
        analyticsConfig.enableUmami &&
        analyticsConfig.umamiScriptUrl &&
        analyticsConfig.umamiWebsiteId
      ) {
        metricsPromises.push({
          source: "umami",
          metrics: analyticsService.getUmamiMetrics({
            websiteId: analyticsConfig.umamiWebsiteId,
            apiUrl: analyticsConfig.umamiScriptUrl,
            startDate: start,
            endDate: end,
            // Note: API key would need to be stored in config if required
          }),
        });
      }


      // Wait for all metrics to be fetched (in parallel)
      const metricsResults = await Promise.allSettled(
        metricsPromises.map((p) => p.metrics),
      );

      // Map results back to sources
      const sourcesWithMetrics = metricsPromises.map((promise, index) => {
        const result = metricsResults[index];
        return {
          source: promise.source,
          metrics:
            result.status === "fulfilled" ? result.value : null,
        };
      });

      // Aggregate metrics from all sources
      const aggregatedMetrics = await analyticsService.aggregateMetrics(
        sourcesWithMetrics,
        start,
        end,
      );

      // Add metadata about which sources provided data
      const activeSources = sourcesWithMetrics
        .filter((s) => s.metrics !== null)
        .map((s) => s.source);

      logger.info("Aggregated analytics metrics", {
        orgId,
        activeSources,
        pageViews: aggregatedMetrics.pageViews,
        visitors: aggregatedMetrics.visitors,
      });

      return aggregatedMetrics;
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

