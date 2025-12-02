import { firestore } from "../infrastructure/firebase";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { v4 as uuidv4 } from "uuid";
import type {
  RecordUsageEventInput,
  UsageEvent,
} from "./usage-types";

/**
 * Usage Tracker Module
 * 
 * This is the single API for recording usage from backend modules.
 * It handles:
 * - Writing raw events to usage_events collection
 * - Incrementing daily and monthly aggregates atomically
 * - Idempotency via eventId
 * - Error handling (best-effort, doesn't fail business flows)
 * 
 * Usage:
 * ```typescript
 * import { recordUsageEvent } from "./usage/usage-tracker";
 * import { USAGE_FEATURES } from "./usage/usage-features";
 * 
 * await recordUsageEvent({
 *   orgId: "org123",
 *   userId: "user456",
 *   featureId: USAGE_FEATURES.INVOICE_CREATE,
 *   metadata: { entityId: "invoice789" }
 * });
 * ```
 * 
 * Guidelines:
 * - Only track events AFTER the operation is successful
 * - Don't track every micro-step, only meaningful business actions
 * - Track actions that incur compute, storage, or external provider cost
 * - Respect multi-tenant boundaries - always pass correct orgId/userId
 */

const COLLECTIONS = {
  EVENTS: "usage_events",
  AGGREGATES_DAILY: "usage_aggregates_daily",
  AGGREGATES_MONTHLY: "usage_aggregates_monthly",
} as const;

const SENTINEL_ALL = "ALL";

/**
 * Generate document ID for daily aggregate
 * Pattern: <orgId>_<YYYY-MM-DD>_<featureId>_<userId-or-ALL>
 */
function getDailyAggregateDocId(
  orgId: string,
  date: string,
  featureId: string,
  userId: string | null
): string {
  const userPart = userId || SENTINEL_ALL;
  return `${orgId}_${date}_${featureId}_${userPart}`;
}

/**
 * Generate document ID for monthly aggregate
 * Pattern: <orgId>_<YYYY-MM>_<featureId>
 */
function getMonthlyAggregateDocId(
  orgId: string,
  month: string,
  featureId: string
): string {
  return `${orgId}_${month}_${featureId}`;
}

/**
 * Convert timestamp to UTC date string (YYYY-MM-DD)
 */
function getDateString(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert timestamp to UTC month string (YYYY-MM)
 */
function getMonthString(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Validate input for recording usage event
 */
function validateInput(input: RecordUsageEventInput): void {
  if (!input.orgId || typeof input.orgId !== "string" || input.orgId.trim() === "") {
    throw new Error("orgId is required and must be a non-empty string");
  }
  
  if (!input.featureId || typeof input.featureId !== "string" || input.featureId.trim() === "") {
    throw new Error("featureId is required and must be a non-empty string");
  }
  
  if (input.count !== undefined && (typeof input.count !== "number" || input.count <= 0)) {
    throw new Error("count must be a positive number if provided");
  }
}

/**
 * Record a usage event and update aggregates
 * 
 * This function:
 * 1. Validates input
 * 2. Checks idempotency if eventId is provided
 * 3. Writes the raw event (if new)
 * 4. Increments daily and monthly aggregates atomically
 * 
 * Errors are logged but do not throw to avoid breaking business flows.
 */
export async function recordUsageEvent(
  input: RecordUsageEventInput
): Promise<void> {
  try {
    // Validate input
    validateInput(input);
    
    const orgId = input.orgId.trim();
    const userId = input.userId ?? null;
    const featureId = input.featureId.trim();
    const action = input.action?.trim();
    const count = input.count ?? 1;
    const metadata = input.metadata;
    const eventId = input.eventId || uuidv4();
    
    const now = Timestamp.now();
    const date = getDateString(now);
    const month = getMonthString(now);
    
    // Check idempotency if eventId is provided
    if (input.eventId) {
      const existingEventRef = firestore
        .collection(COLLECTIONS.EVENTS)
        .doc(eventId);
      
      const existingEvent = await existingEventRef.get();
      
      if (existingEvent.exists) {
        // Event already exists, skip to avoid double-counting
        loggerService.debug("Usage event already exists, skipping", {
          eventId,
          orgId,
          featureId,
        });
        return;
      }
    }
    
    // Build the usage event document
    const usageEvent: UsageEvent = {
      eventId,
      orgId,
      userId,
      featureId,
      action,
      count,
      metadata,
      createdAt: now,
      schemaVersion: 1,
    };
    
    // Prepare aggregate updates
    const dailyDocId = getDailyAggregateDocId(orgId, date, featureId, userId);
    const monthlyDocId = getMonthlyAggregateDocId(orgId, month, featureId);
    
    const dailyRef = firestore
      .collection(COLLECTIONS.AGGREGATES_DAILY)
      .doc(dailyDocId);
    
    const monthlyRef = firestore
      .collection(COLLECTIONS.AGGREGATES_MONTHLY)
      .doc(monthlyDocId);
    
    // Use a transaction to ensure consistency
    await firestore.runTransaction(async (transaction) => {
      // Write the raw event
      transaction.set(
        firestore.collection(COLLECTIONS.EVENTS).doc(eventId),
        usageEvent
      );
      
      // Update or create daily aggregate
      const dailyDoc = await transaction.get(dailyRef);
      
      if (dailyDoc.exists) {
        // Increment existing aggregate
        transaction.update(dailyRef, {
          totalCount: FieldValue.increment(count),
          summedSizeBytes: FieldValue.increment(metadata?.sizeBytes || 0),
          summedDurationMs: FieldValue.increment(metadata?.durationMs || 0),
          updatedAt: now,
        });
      } else {
        // Create new aggregate
        transaction.set(dailyRef, {
          orgId,
          userId,
          featureId,
          date,
          totalCount: count,
          summedSizeBytes: metadata?.sizeBytes || 0,
          summedDurationMs: metadata?.durationMs || 0,
          updatedAt: now,
        });
      }
      
      // Update or create monthly aggregate
      const monthlyDoc = await transaction.get(monthlyRef);
      
      if (monthlyDoc.exists) {
        // Increment existing aggregate
        transaction.update(monthlyRef, {
          totalCount: FieldValue.increment(count),
          summedSizeBytes: FieldValue.increment(metadata?.sizeBytes || 0),
          summedDurationMs: FieldValue.increment(metadata?.durationMs || 0),
          updatedAt: now,
        });
      } else {
        // Create new aggregate
        transaction.set(monthlyRef, {
          orgId,
          featureId,
          month,
          totalCount: count,
          summedSizeBytes: metadata?.sizeBytes || 0,
          summedDurationMs: metadata?.durationMs || 0,
          updatedAt: now,
        });
      }
    });
    
    loggerService.debug("Usage event recorded successfully", {
      eventId,
      orgId,
      featureId,
      count,
    });
  } catch (error) {
    // Log error but don't throw - usage tracking should not break business flows
    loggerService.error("Failed to record usage event", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      input: {
        orgId: input.orgId,
        userId: input.userId,
        featureId: input.featureId,
        action: input.action,
      },
    });
    
    // In production, you might want to send this to monitoring/alerting
    // For now, we just log it
  }
}

/**
 * Record usage event with best-effort error handling (non-throwing wrapper)
 * Use this when you want to ensure the call never throws
 */
export async function recordUsageEventSafe(
  input: RecordUsageEventInput
): Promise<boolean> {
  try {
    await recordUsageEvent(input);
    return true;
  } catch {
    return false;
  }
}

