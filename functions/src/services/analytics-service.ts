import { logger } from "firebase-functions";
import type { QuerySnapshot, DocumentData } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";

export interface AnalyticsMetrics {
  pageViews: number;
  visitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: Array<{ source: string; visitors: number }>;
  devices: Array<{ device: string; visitors: number }>;
  browsers: Array<{ browser: string; visitors: number }>;
  referrers: Array<{ referrer: string; visitors: number }>;
  pageViewsOverTime: Array<{ date: string; views: number; desktop: number; mobile: number; tablet: number }>;
  dateRange: {
    start: string;
    end: string;
  };
  warning?: string;
  indexError?: {
    message: string;
    indexUrl?: string;
  };
  dataSources?: Array<"firestore" | "ga4" | "plausible" | "umami" | "clarity">;
}

export interface AnalyticsQueryParams {
  propertyId: string;
  startDate: string;
  endDate: string;
  orgId: string;
}

/**
 * Analytics Service for fetching real analytics data
 * Supports GA4 via Google Analytics Data API
 */
export class AnalyticsService {
  /**
   * Fetch analytics metrics from GA4
   * Requires GA4 property ID and OAuth/service account credentials
   */
  async getGA4Metrics(params: AnalyticsQueryParams): Promise<AnalyticsMetrics | null> {
    const { propertyId, startDate, endDate } = params;

    if (!propertyId) {
      logger.warn("GA4 property ID not provided");
      return null;
    }

    try {
      // Extract property ID from measurement ID (G-XXXXXXXXXX -> property ID)
      // For now, we'll use the measurement ID directly
      // In production, you'd need to map measurement ID to property ID
      
      // Note: This requires Google Analytics Data API credentials
      // For now, return null and log that integration is needed
      logger.info("GA4 metrics fetch requested", {
        propertyId,
        startDate,
        endDate,
        orgId: params.orgId,
      });

      // TODO: Implement actual GA4 Data API integration
      // This requires:
      // 1. OAuth token or service account credentials
      // 2. Google Analytics Data API client library
      // 3. Property ID mapping from measurement ID
      
      return null;
    } catch (error) {
      logger.error("Failed to fetch GA4 metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
        params,
      });
      return null;
    }
  }

  /**
   * Fetch analytics events from Firestore (if we're storing them)
   * This provides real-time analytics from our own tracking
   */
  async getStoredAnalyticsEvents(
    orgId: string,
    siteId: string | undefined,
    startDate: string,
    endDate: string,
  ): Promise<AnalyticsMetrics | null> {
    try {
      const { firestore } = await import("firebase-admin");
      
      // Query analytics events from Firestore
      // Events are stored when analytics-loader.js tracks them
      const eventsRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsEvents");

      // Parse dates correctly - ensure we're using UTC midnight for start and end of day
      const startDateObj = new Date(startDate + "T00:00:00.000Z");
      const endDateObj = new Date(endDate + "T23:59:59.999Z");
      const startTimestamp = firestore.Timestamp.fromDate(startDateObj);
      const endTimestamp = firestore.Timestamp.fromDate(endDateObj);
      
      logger.info("Querying analytics events", {
        orgId,
        siteId: siteId || "all",
        startDate,
        endDate,
        startTimestamp: startTimestamp.toMillis(),
        endTimestamp: endTimestamp.toMillis(),
      });
      
      let snapshot: QuerySnapshot<DocumentData>;
      let indexError: { message: string; indexUrl?: string } | undefined;
      
      // If siteId is provided, try composite index query first
      // If index doesn't exist, fall back to timestamp-only query and filter in memory
      if (siteId) {
        try {
          // Try composite index query (site_id first, then timestamp range)
          const compositeQuery = eventsRef
            .where("site_id", "==", siteId)
            .where("timestamp", ">=", startTimestamp)
            .where("timestamp", "<=", endTimestamp);
          snapshot = await compositeQuery.get();
          logger.info("Composite query executed", {
            orgId,
            siteId,
            count: snapshot.size,
          });
        } catch (error: any) {
          // If index doesn't exist yet, fall back to timestamp-only query
          if (error?.code === 9 || error?.message?.includes("index")) {
            logger.warn("Composite index not ready, falling back to timestamp-only query", {
              orgId,
              siteId,
              error: error.message,
            });
            
            // Extract index URL from error message if available
            const indexUrlMatch = error.message?.match(/https:\/\/[^\s]+/);
            const indexUrl = indexUrlMatch ? indexUrlMatch[0] : undefined;
            
            // Store error info to return to frontend
            indexError = {
              message: error.message || "Firestore composite index is not ready. Using fallback query (may be slower).",
              indexUrl,
            };
            
            // Query by timestamp only and filter by siteId in memory
            const timestampQuery = eventsRef
              .where("timestamp", ">=", startTimestamp)
              .where("timestamp", "<=", endTimestamp);
            snapshot = await timestampQuery.get();
            logger.info("Timestamp-only query executed (fallback)", {
              orgId,
              siteId,
              count: snapshot.size,
            });
          } else {
            throw error;
          }
        }
      } else {
        // Query by timestamp only (no composite index needed)
        const timestampQuery = eventsRef
          .where("timestamp", ">=", startTimestamp)
          .where("timestamp", "<=", endTimestamp);
        snapshot = await timestampQuery.get();
        logger.info("Timestamp-only query executed", {
          orgId,
          count: snapshot.size,
        });
      }

      if (snapshot.empty) {
        logger.warn("No analytics events found with siteId filter", {
          orgId,
          siteId: siteId || "all",
          startDate,
          endDate,
        });
        
        // If we filtered by siteId and found nothing, try querying all events for the org
        // to see if there are any events at all (in case siteId doesn't match)
        if (siteId) {
          logger.info("Trying fallback query without siteId filter", {
            orgId,
            startDate,
            endDate,
          });
          
          const fallbackQuery = eventsRef
            .where("timestamp", ">=", startTimestamp)
            .where("timestamp", "<=", endTimestamp);
          const fallbackSnapshot = await fallbackQuery.get();
          
          if (!fallbackSnapshot.empty) {
            logger.warn("Found events without siteId filter - siteId may not match stored events", {
              orgId,
              siteId,
              totalEvents: fallbackSnapshot.size,
            });
            // Continue with fallback snapshot - we'll filter by siteId in memory below
            snapshot = fallbackSnapshot;
          } else {
            logger.info("No events found even without siteId filter", {
              orgId,
              startDate,
              endDate,
            });
            
            const emptyResult: AnalyticsMetrics = {
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
              dateRange: { start: startDate, end: endDate },
              dataSources: [],
            };
            
            // Attach index error if present
            if (indexError) {
              emptyResult.warning = "Using fallback query - composite index not ready";
              emptyResult.indexError = indexError;
            }
            
            return emptyResult;
          }
        } else {
          // No siteId filter was used, so there really are no events
          const emptyResult: AnalyticsMetrics = {
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
            dateRange: { start: startDate, end: endDate },
            dataSources: [],
          };
          
          // Attach index error if present
          if (indexError) {
            emptyResult.warning = "Using fallback query - composite index not ready";
            emptyResult.indexError = indexError;
          }
          
          return emptyResult;
        }
      }

      let events = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
      
      logger.info("Events retrieved from query", {
        orgId,
        siteId: siteId || "all",
        totalEvents: events.length,
      });
      
      // If siteId was not used in query, filter by siteId in memory
      if (!siteId) {
        // No siteId filter needed - use all events
        logger.info("No siteId filter applied - using all events");
      } else {
        // Double-check siteId filter (in case query didn't use it)
        // Match events where site_id exactly equals the provided siteId
        const beforeFilter = events.length;
        events = events.filter((e: Record<string, unknown>) => e.site_id === siteId);
        logger.info("SiteId filter applied", {
          orgId,
          siteId,
          beforeFilter,
          afterFilter: events.length,
        });
      }
      
      const pageViewEvents = events.filter((e: Record<string, unknown>) => e.event === "page_view");
      
      logger.info("Page view events filtered", {
        orgId,
        totalEvents: events.length,
        pageViewEvents: pageViewEvents.length,
      });
      const uniqueVisitors = new Set(events.map((e: Record<string, unknown>) => e.client_id || e.user_id)).size;
      
      // Calculate metrics
      const pageViews = pageViewEvents.length;
      const visitors = uniqueVisitors;
      
      // Group by page path
      const pageViewsByPath = pageViewEvents.reduce((acc: Record<string, number>, event: any) => {
        const path = event.page_path || "/";
        acc[path] = (acc[path] || 0) + 1;
        return acc;
      }, {});

      const topPages = Object.entries(pageViewsByPath)
        .map(([path, views]) => ({ path, views: views as number }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Group by traffic source
      const sources = events.reduce((acc: Record<string, number>, event: any) => {
        const source = event.utm_source || event.referrer || "direct";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});

      const trafficSources = Object.entries(sources)
        .map(([source, visitors]) => ({ source, visitors: visitors as number }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);

      // Parse user agent for device and browser info
      const deviceMap: Record<string, number> = {};
      const browserMap: Record<string, number> = {};
      const referrerMap: Record<string, number> = {};

      events.forEach((event: Record<string, unknown>) => {
        const userAgent = (event.user_agent as string) || "";
        const referrer = (event.referrer as string) || "";

        // Simple device detection
        let device = "Unknown";
        if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
          device = "Mobile";
        } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
          device = "Tablet";
        } else {
          device = "Desktop";
        }
        deviceMap[device] = (deviceMap[device] || 0) + 1;

        // Simple browser detection
        let browser = "Unknown";
        if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
          browser = "Chrome";
        } else if (userAgent.includes("Firefox")) {
          browser = "Firefox";
        } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
          browser = "Safari";
        } else if (userAgent.includes("Edg")) {
          browser = "Edge";
        } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
          browser = "Opera";
        }
        browserMap[browser] = (browserMap[browser] || 0) + 1;

        // Track referrers (excluding direct traffic and empty referrers)
        if (referrer && referrer.trim() !== "") {
          try {
            const referrerUrl = new URL(referrer);
            const domain = referrerUrl.hostname.replace("www.", "");
            referrerMap[domain] = (referrerMap[domain] || 0) + 1;
          } catch {
            // Invalid URL, skip
          }
        }
      });

      const devices = Object.entries(deviceMap)
        .map(([device, visitors]) => ({ device, visitors }))
        .sort((a, b) => b.visitors - a.visitors);

      const browsers = Object.entries(browserMap)
        .map(([browser, visitors]) => ({ browser, visitors }))
        .sort((a, b) => b.visitors - a.visitors);

      const referrers = Object.entries(referrerMap)
        .map(([referrer, visitors]) => ({ referrer, visitors }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);

      // Group page views by date
      const pageViewsByDateAndDevice: Record<string, { desktop: number; mobile: number; tablet: number }> = {};
      pageViewEvents.forEach((event: Record<string, unknown>) => {
        const timestamp = event.timestamp;
        const userAgent = (event.user_agent as string) || "";
        
        // Detect device type
        let device: "desktop" | "mobile" | "tablet" = "desktop";
        if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
          device = "mobile";
        } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
          device = "tablet";
        }
        
        let date: Date | null = null;
        
        // Handle Firestore Timestamp object
        if (timestamp instanceof Timestamp) {
          // Direct Firestore Timestamp instance
          date = timestamp.toDate();
        } else if (timestamp && typeof timestamp === "object") {
          // Check if it's a Firestore Timestamp (has toDate method)
          if ("toDate" in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === "function") {
            date = (timestamp as { toDate: () => Date }).toDate();
          } else if ("toMillis" in timestamp && typeof (timestamp as { toMillis: () => number }).toMillis === "function") {
            // Firestore Timestamp with toMillis method
            const millis = (timestamp as { toMillis: () => number }).toMillis();
            date = new Date(millis);
          } else if ("_seconds" in timestamp || "seconds" in timestamp) {
            // Firestore Timestamp with seconds property (serialized format)
            const seconds = (timestamp as { _seconds?: number; seconds?: number })._seconds || 
                           (timestamp as { _seconds?: number; seconds?: number }).seconds || 0;
            const nanoseconds = (timestamp as { _nanoseconds?: number; nanoseconds?: number })._nanoseconds || 
                               (timestamp as { _nanoseconds?: number; nanoseconds?: number }).nanoseconds || 0;
            date = new Date(seconds * 1000 + nanoseconds / 1000000);
          }
        } else if (timestamp && typeof timestamp === "string") {
          // String timestamp
          date = new Date(timestamp);
        } else if (timestamp && typeof timestamp === "number") {
          // Unix timestamp (milliseconds or seconds)
          date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000);
        }
        
        if (date && !isNaN(date.getTime())) {
          const dateStr = date.toISOString().split("T")[0];
          if (!pageViewsByDateAndDevice[dateStr]) {
            pageViewsByDateAndDevice[dateStr] = { desktop: 0, mobile: 0, tablet: 0 };
          }
          pageViewsByDateAndDevice[dateStr][device]++;
        } else {
          logger.warn("Invalid or missing timestamp in analytics event", {
            orgId,
            siteId: siteId || "all",
            eventType: event.event,
            timestampType: typeof timestamp,
            hasTimestamp: !!timestamp,
          });
        }
      });
      
      logger.info("Page views grouped by date and device", {
        orgId,
        siteId: siteId || "all",
        datesWithViews: Object.keys(pageViewsByDateAndDevice).length,
        totalPageViews: Object.values(pageViewsByDateAndDevice).reduce(
          (sum, counts) => sum + counts.desktop + counts.mobile + counts.tablet,
          0
        ),
      });

      // Fill in missing dates in range (using UTC to avoid timezone issues)
      const pageViewsOverTime: Array<{ date: string; views: number; desktop: number; mobile: number; tablet: number }> = [];
      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");
      
      // Iterate through each day in the range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayData = pageViewsByDateAndDevice[dateStr] || { desktop: 0, mobile: 0, tablet: 0 };
        pageViewsOverTime.push({
          date: dateStr,
          views: dayData.desktop + dayData.mobile + dayData.tablet,
          desktop: dayData.desktop,
          mobile: dayData.mobile,
          tablet: dayData.tablet,
        });
        // Move to next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      const result: AnalyticsMetrics = {
        pageViews,
        visitors,
        bounceRate: 0, // Would need session data to calculate
        avgSessionDuration: 0, // Would need session data to calculate
        topPages,
        trafficSources,
        devices,
        browsers,
        referrers,
        pageViewsOverTime,
        dateRange: { start: startDate, end: endDate },
        dataSources: ["firestore"], // Always include firestore as data source when we have data
      };
      
      // Attach index error if present
      if (indexError) {
        result.warning = "Using fallback query - composite index not ready";
        result.indexError = indexError;
      }
      
      return result;
    } catch (error) {
      logger.error("Failed to fetch stored analytics events", {
        error: error instanceof Error ? error.message : "Unknown error",
        orgId,
        siteId,
      });
      // Return empty metrics instead of null to ensure we always have a result
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
        dateRange: { start: startDate, end: endDate },
        dataSources: [],
        warning: "Failed to fetch analytics events from Firestore",
      };
    }
  }

  /**
   * Fetch analytics metrics from Plausible API
   * Requires Plausible API key and domain
   */
  async getPlausibleMetrics(params: {
    domain: string;
    apiKey?: string;
    startDate: string;
    endDate: string;
  }): Promise<AnalyticsMetrics | null> {
    const { domain, apiKey, startDate, endDate } = params;

    if (!domain) {
      logger.warn("Plausible domain not provided");
      return null;
    }

    try {
      // Plausible Stats API endpoint
      // Note: This requires a Plausible API key for self-hosted instances
      // For cloud.plausible.io, you need to use their API
      const apiUrl = apiKey
        ? `https://plausible.io/api/v1/stats/aggregate?site_id=${encodeURIComponent(domain)}&period=custom&date=${startDate},${endDate}`
        : null;

      if (!apiUrl) {
        logger.info("Plausible API key not provided - skipping API fetch", { domain });
        return null;
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        logger.warn("Plausible API request failed", {
          status: response.status,
          domain,
        });
        return null;
      }

      const data = await response.json();

      // Transform Plausible data to our metrics format
      return {
        pageViews: data.results?.pageviews || 0,
        visitors: data.results?.visitors || 0,
        bounceRate: data.results?.bounce_rate || 0,
        avgSessionDuration: data.results?.visit_duration || 0,
        topPages: [],
        trafficSources: [],
        devices: [],
        browsers: [],
        referrers: [],
        pageViewsOverTime: [],
        dateRange: { start: startDate, end: endDate },
      };
    } catch (error) {
      logger.error("Failed to fetch Plausible metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
        domain,
      });
      return null;
    }
  }

  /**
   * Fetch analytics metrics from Umami API
   * Requires Umami API endpoint and API key
   */
  async getUmamiMetrics(params: {
    websiteId: string;
    apiUrl: string;
    apiKey?: string;
    startDate: string;
    endDate: string;
  }): Promise<AnalyticsMetrics | null> {
    const { websiteId, apiUrl, apiKey, startDate, endDate } = params;

    if (!websiteId || !apiUrl) {
      logger.warn("Umami website ID or API URL not provided");
      return null;
    }

    try {
      // Umami API endpoint for metrics
      const baseUrl = apiUrl.replace(/\/script\.js$/, "").replace(/\/$/, "");
      const metricsUrl = `${baseUrl}/api/websites/${websiteId}/stats?start_at=${startDate}&end_at=${endDate}`;

      const response = await fetch(metricsUrl, {
        headers: {
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        logger.warn("Umami API request failed", {
          status: response.status,
          websiteId,
        });
        return null;
      }

      const data = await response.json();

      // Transform Umami data to our metrics format
      return {
        pageViews: data.pageviews || 0,
        visitors: data.visitors || 0,
        bounceRate: 0, // Umami doesn't provide bounce rate directly
        avgSessionDuration: 0, // Would need additional API call
        topPages: data.pages?.map((p: any) => ({ path: p.path || "/", views: p.pageviews || 0 })) || [],
        trafficSources: data.sources?.map((s: any) => ({ source: s.source || "direct", visitors: s.visitors || 0 })) || [],
        devices: [],
        browsers: [],
        referrers: [],
        pageViewsOverTime: [],
        dateRange: { start: startDate, end: endDate },
      };
    } catch (error) {
      logger.error("Failed to fetch Umami metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
        websiteId,
      });
      return null;
    }
  }

  /**
   * Aggregate metrics from multiple sources
   * Combines data from Firestore and other analytics providers
   */
  async aggregateMetrics(
    sources: Array<{
      source: "firestore" | "ga4" | "plausible" | "umami" | "clarity";
      metrics: AnalyticsMetrics | null;
    }>,
    startDate: string,
    endDate: string,
  ): Promise<AnalyticsMetrics> {
    const validMetrics = sources.filter((s) => s.metrics !== null).map((s) => s.metrics!);

    if (validMetrics.length === 0) {
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
        dateRange: { start: startDate, end: endDate },
        dataSources: [],
      };
    }

    // For aggregation, we'll use the source with the most data
    // In the future, we could deduplicate and merge intelligently
    let primaryMetrics = validMetrics[0];
    let maxPageViews = primaryMetrics.pageViews;

    for (const metrics of validMetrics) {
      if (metrics.pageViews > maxPageViews) {
        maxPageViews = metrics.pageViews;
        primaryMetrics = metrics;
      }
    }

    // Merge top pages from all sources (deduplicate by path)
    const topPagesMap = new Map<string, number>();
    validMetrics.forEach((metrics) => {
      metrics.topPages.forEach((page) => {
        const current = topPagesMap.get(page.path) || 0;
        topPagesMap.set(page.path, current + page.views);
      });
    });

    // Merge traffic sources
    const sourcesMap = new Map<string, number>();
    validMetrics.forEach((metrics) => {
      metrics.trafficSources.forEach((source) => {
        const current = sourcesMap.get(source.source) || 0;
        sourcesMap.set(source.source, current + source.visitors);
      });
    });

    // Merge devices
    const devicesMap = new Map<string, number>();
    validMetrics.forEach((metrics) => {
      metrics.devices.forEach((device) => {
        const current = devicesMap.get(device.device) || 0;
        devicesMap.set(device.device, current + device.visitors);
      });
    });

    // Merge browsers
    const browsersMap = new Map<string, number>();
    validMetrics.forEach((metrics) => {
      metrics.browsers.forEach((browser) => {
        const current = browsersMap.get(browser.browser) || 0;
        browsersMap.set(browser.browser, current + browser.visitors);
      });
    });

    // Merge referrers
    const referrersMap = new Map<string, number>();
    validMetrics.forEach((metrics) => {
      metrics.referrers.forEach((referrer) => {
        const current = referrersMap.get(referrer.referrer) || 0;
        referrersMap.set(referrer.referrer, current + referrer.visitors);
      });
    });

    // Merge page views over time
    const pageViewsOverTimeMap = new Map<string, { views: number; desktop: number; mobile: number; tablet: number }>();
    validMetrics.forEach((metrics) => {
      metrics.pageViewsOverTime.forEach((day) => {
        const current = pageViewsOverTimeMap.get(day.date) || { views: 0, desktop: 0, mobile: 0, tablet: 0 };
        pageViewsOverTimeMap.set(day.date, {
          views: current.views + day.views,
          desktop: current.desktop + (day.desktop || 0),
          mobile: current.mobile + (day.mobile || 0),
          tablet: current.tablet + (day.tablet || 0),
        });
      });
    });

    // Collect data sources that provided valid metrics
    const dataSources = sources
      .filter((s) => s.metrics !== null)
      .map((s) => s.source) as Array<"firestore" | "ga4" | "plausible" | "umami" | "clarity">;

    return {
      pageViews: primaryMetrics.pageViews,
      visitors: primaryMetrics.visitors,
      bounceRate: primaryMetrics.bounceRate,
      avgSessionDuration: primaryMetrics.avgSessionDuration,
      topPages: Array.from(topPagesMap.entries())
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
      trafficSources: Array.from(sourcesMap.entries())
        .map(([source, visitors]) => ({ source, visitors }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10),
      devices: Array.from(devicesMap.entries())
        .map(([device, visitors]) => ({ device, visitors }))
        .sort((a, b) => b.visitors - a.visitors),
      browsers: Array.from(browsersMap.entries())
        .map(([browser, visitors]) => ({ browser, visitors }))
        .sort((a, b) => b.visitors - a.visitors),
      referrers: Array.from(referrersMap.entries())
        .map(([referrer, visitors]) => ({ referrer, visitors }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10),
      pageViewsOverTime: Array.from(pageViewsOverTimeMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      dateRange: { start: startDate, end: endDate },
      warning: primaryMetrics.warning,
      indexError: primaryMetrics.indexError,
      dataSources,
    };
  }
}

