/**
 * Firestore trigger to invalidate brand context cache when organization data changes.
 * 
 * This ensures the cache stays in sync when organization settings, branding,
 * or other brand-relevant data is updated from the frontend.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getBrandContextCache } from "../services/brand-context-cache";

/**
 * Triggered when an organization document is updated.
 * Invalidates the brand context cache for that organization.
 */
export const onOrganizationUpdated = onDocumentUpdated(
  {
    document: "organizations/{organizationId}",
    region: "us-central1",
  },
  async (event) => {
    const organizationId = event.params.organizationId;
    
    if (!organizationId) {
      logger.warn("Organization update trigger fired but organizationId is missing");
      return;
    }

    try {
      const cache = getBrandContextCache();
      cache.invalidate(organizationId);
      
      logger.info("Brand context cache invalidated due to organization update", {
        organizationId,
      });
    } catch (error) {
      logger.error("Failed to invalidate brand context cache on organization update", {
        organizationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - cache invalidation failure shouldn't break the update
    }
  }
);

