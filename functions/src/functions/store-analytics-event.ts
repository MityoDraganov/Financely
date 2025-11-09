import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getAnalyticsEventRepository } from "../repositories/analytics-event-repository";

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
    try {
      // Only allow POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const {
        orgId,
        event,
        siteId,
        brandName,
        pagePath,
        pageTitle,
        referrer,
        clientId,
        userAgent,
        ...otherParams
      } = req.body;

      if (!orgId || !event) {
        res.status(400).json({ error: "orgId and event are required" });
        return;
      }

      const databaseService = getDatabaseService();
      const analyticsEventRepository = getAnalyticsEventRepository(databaseService);

      const eventData = {
        org_id: orgId,
        site_id: siteId || null,
        brand_name: brandName || null,
        event,
        page_path: pagePath || null,
        page_title: pageTitle || null,
        referrer: referrer || null,
        client_id: clientId || null,
        user_agent: userAgent || null,
        ...otherParams,
      };

      await analyticsEventRepository.create(orgId, eventData);

      logger.debug("Analytics event stored", {
        orgId,
        event,
        siteId,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error storing analytics event", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: req.body,
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to store analytics event",
      });
    }
  },
);

