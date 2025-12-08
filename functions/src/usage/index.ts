/**
 * Usage Tracking Module
 * 
 * Centralized usage tracking for the Financely platform.
 * 
 * This module provides:
 * - Type-safe usage event recording
 * - Automatic daily and monthly aggregation
 * - Idempotency support
 * - Best-effort error handling (doesn't break business flows)
 * 
 * Usage example:
 * ```typescript
 * import { recordUsageEvent } from "./usage";
 * import { USAGE_FEATURES } from "./usage/usage-features";
 * 
 * // After successfully creating an invoice
 * await recordUsageEvent({
 *   orgId: invoice.orgId,
 *   userId: userContext?.userId || null,
 *   featureId: USAGE_FEATURES.INVOICE_CREATE,
 *   metadata: {
 *     entityId: invoiceId,
 *     context: "api",
 *   },
 * });
 * ```
 */

export { recordUsageEvent, recordUsageEventSafe } from "./usage-tracker";
export { USAGE_FEATURES, type UsageFeatureId } from "./usage-features";
export type {
  UsageEvent,
  UsageEventMetadata,
  UsageAggregateDaily,
  UsageAggregateMonthly,
  RecordUsageEventInput,
} from "./usage-types";






