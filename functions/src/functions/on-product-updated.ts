/**
 * Firestore trigger to invalidate brand context cache when product data changes.
 * 
 * This ensures the cache stays in sync when products are created, updated,
 * or deleted, since products are part of brand context.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getBrandContextCache } from "../services/brand-context-cache";

/**
 * Triggered when a product document is created, updated, or deleted.
 * Invalidates the brand context cache for the product's organization.
 */
export const onProductWritten = onDocumentWritten(
  {
    document: "products/{productId}",
    region: "us-central1",
  },
  async (event) => {
    const productId = event.params.productId;
    
    if (!productId) {
      logger.warn("Product write trigger fired but productId is missing");
      return;
    }

    try {
      // Get organizationId from the product data
      let organizationId: string | undefined;
      
      if (event.data?.after?.exists) {
        // Product created or updated - get organizationId from new data
        organizationId = event.data.after.data()?.organizationId;
      } else if (event.data?.before?.exists) {
        // Product deleted - get organizationId from old data
        organizationId = event.data.before.data()?.organizationId;
      }

      if (!organizationId) {
        logger.warn("Product write trigger fired but organizationId is missing", {
          productId,
        });
        return;
      }

      const cache = getBrandContextCache();
      cache.invalidate(organizationId);
      
      const changeType = event.data?.after?.exists
        ? (event.data?.before?.exists ? "updated" : "created")
        : "deleted";
      
      logger.info("Brand context cache invalidated due to product change", {
        productId,
        organizationId,
        changeType,
      });
    } catch (error) {
      logger.error("Failed to invalidate brand context cache on product change", {
        productId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
);

