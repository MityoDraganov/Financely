import { Timestamp } from "firebase-admin/firestore";

/**
 * Usage Tracking Types
 * 
 * This module defines the canonical data models for usage tracking.
 * All usage events are append-only and aggregated for billing/limits.
 */

/**
 * Metadata for usage events
 * Optional context that provides additional information about the usage
 */
export interface UsageEventMetadata {
  /** Entity ID related to the usage (invoiceId, proposalId, workflowId, etc.) */
  entityId?: string;
  
  /** Context where the usage occurred (editor, api, automation, widget, site-builder) */
  context?: string;
  
  /** Size in bytes for storage-related usage or payload sizes */
  sizeBytes?: number;
  
  /** Duration in milliseconds for workflows, AI calls, HTTP executions, etc. */
  durationMs?: number;
  
  /** Type of payload (invoice, proposal, email_template, etc.) */
  payloadType?: string;
  
  /** Plan override or tier if needed in the future */
  planOverride?: string;
  tier?: string;
  
  /** IP address if available and needed */
  ip?: string;
  
  /** User agent if available and needed */
  userAgent?: string;
  
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Raw usage event document stored in usage_events collection
 * Each document represents a single logical usage event
 */
export interface UsageEvent {
  /** Unique event ID - also used as Firestore document ID when available */
  eventId: string;
  
  /** Organization ID - required, main partition key */
  orgId: string;
  
  /** User ID in the organization - null for system events */
  userId: string | null;
  
  /** Feature identifier (e.g., invoice.create, proposal.generate, workflow.run) */
  featureId: string;
  
  /** Optional second-level action (create, send, view, run, etc.) */
  action?: string;
  
  /** Count - default 1, allows tracking bulk operations */
  count: number;
  
  /** Optional metadata with typed fields */
  metadata?: UsageEventMetadata;
  
  /** Server timestamp when event was created */
  createdAt: Timestamp;
  
  /** Schema version for future migrations */
  schemaVersion: number;
}

/**
 * Daily usage aggregate document stored in usage_aggregates_daily collection
 * Represents aggregated usage for a specific date, org, feature, and optionally user
 */
export interface UsageAggregateDaily {
  /** Organization ID */
  orgId: string;
  
  /** User ID or null/ALL for org-wide aggregation */
  userId: string | null;
  
  /** Feature identifier */
  featureId: string;
  
  /** Date in YYYY-MM-DD format (UTC) */
  date: string;
  
  /** Total count of events (incremented atomically) */
  totalCount: number;
  
  /** Sum of sizeBytes from events.metadata */
  summedSizeBytes: number;
  
  /** Sum of durationMs from events.metadata */
  summedDurationMs: number;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

/**
 * Monthly usage aggregate document stored in usage_aggregates_monthly collection
 * Represents aggregated usage for a specific month, org, and feature
 */
export interface UsageAggregateMonthly {
  /** Organization ID */
  orgId: string;
  
  /** Feature identifier */
  featureId: string;
  
  /** Month in YYYY-MM format (UTC) */
  month: string;
  
  /** Total count of events */
  totalCount: number;
  
  /** Sum of sizeBytes from events.metadata */
  summedSizeBytes: number;
  
  /** Sum of durationMs from events.metadata */
  summedDurationMs: number;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

/**
 * Input for recording a usage event
 */
export interface RecordUsageEventInput {
  /** Organization ID - required */
  orgId: string;
  
  /** User ID - optional, null for system events */
  userId?: string | null;
  
  /** Feature ID - required, use constants from usage-features.ts */
  featureId: string;
  
  /** Action - optional, second-level action */
  action?: string;
  
  /** Count - optional, default 1 */
  count?: number;
  
  /** Metadata - optional */
  metadata?: UsageEventMetadata;
  
  /** Event ID - optional, for idempotency */
  eventId?: string;
}







