import { test } from "node:test";
import assert from "node:assert";
import { getApps, initializeApp } from "firebase-admin/app";
import { firestore } from "../infrastructure/firebase";
import { recordUsageEvent } from "./usage-tracker";
import { USAGE_FEATURES } from "./usage-features";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Initialize Firebase Admin for tests
 */
if (!getApps().length) {
  initializeApp({
    projectId: "test-project",
  });
}

/**
 * Unit tests for usage tracking module
 * 
 * These tests verify:
 * - Event recording creates documents correctly
 * - Daily and monthly aggregates are created and incremented
 * - Idempotency prevents double-counting
 * - Metadata aggregation works correctly
 */

const TEST_COLLECTIONS = {
  EVENTS: "usage_events",
  AGGREGATES_DAILY: "usage_aggregates_daily",
  AGGREGATES_MONTHLY: "usage_aggregates_monthly",
} as const;

/**
 * Clean up test data
 */
async function cleanupTestData(orgId: string, featureId: string, eventId?: string): Promise<void> {
  try {
    // Delete test events
    if (eventId) {
      await firestore().collection(TEST_COLLECTIONS.EVENTS).doc(eventId).delete().catch(() => {});
    }
    
    // Delete test aggregates (find by orgId and featureId)
    const dailySnapshot = await firestore()
      .collection(TEST_COLLECTIONS.AGGREGATES_DAILY)
      .where("orgId", "==", orgId)
      .where("featureId", "==", featureId)
      .get();
    
    for (const doc of dailySnapshot.docs) {
      await doc.ref.delete().catch(() => {});
    }
    
    const monthlySnapshot = await firestore()
      .collection(TEST_COLLECTIONS.AGGREGATES_MONTHLY)
      .where("orgId", "==", orgId)
      .where("featureId", "==", featureId)
      .get();
    
    for (const doc of monthlySnapshot.docs) {
      await doc.ref.delete().catch(() => {});
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn("Cleanup error (ignored):", error);
  }
}

test("Record usage event - creates event and aggregates", async () => {
  const orgId = `test-org-${Date.now()}`;
  const userId = `test-user-${Date.now()}`;
  const featureId = USAGE_FEATURES.INVOICE_CREATE;
  const eventId = `test-event-${Date.now()}`;
  
  try {
    // Record event
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId,
      metadata: {
        entityId: "invoice123",
        context: "api",
      },
    });
    
    // Verify event was created
    const eventDoc = await firestore().collection(TEST_COLLECTIONS.EVENTS).doc(eventId).get();
    assert.ok(eventDoc.exists, "Event document should exist");
    
    const eventData = eventDoc.data();
    assert.strictEqual(eventData?.orgId, orgId);
    assert.strictEqual(eventData?.userId, userId);
    assert.strictEqual(eventData?.featureId, featureId);
    assert.strictEqual(eventData?.count, 1);
    assert.strictEqual(eventData?.metadata?.entityId, "invoice123");
    
    // Verify daily aggregate was created
    const now = Timestamp.now();
    const date = now.toDate();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;
    
    const dailyDocId = `${orgId}_${dateStr}_${featureId}_${userId}`;
    const dailyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_DAILY).doc(dailyDocId).get();
    assert.ok(dailyDoc.exists, "Daily aggregate should exist");
    
    const dailyData = dailyDoc.data();
    assert.strictEqual(dailyData?.orgId, orgId);
    assert.strictEqual(dailyData?.userId, userId);
    assert.strictEqual(dailyData?.featureId, featureId);
    assert.strictEqual(dailyData?.date, dateStr);
    assert.strictEqual(dailyData?.totalCount, 1);
    
    // Verify monthly aggregate was created
    const monthlyDocId = `${orgId}_${monthStr}_${featureId}`;
    const monthlyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_MONTHLY).doc(monthlyDocId).get();
    assert.ok(monthlyDoc.exists, "Monthly aggregate should exist");
    
    const monthlyData = monthlyDoc.data();
    assert.strictEqual(monthlyData?.orgId, orgId);
    assert.strictEqual(monthlyData?.featureId, featureId);
    assert.strictEqual(monthlyData?.month, monthStr);
    assert.strictEqual(monthlyData?.totalCount, 1);
  } finally {
    await cleanupTestData(orgId, featureId, eventId);
  }
});

test("Record usage event - increments existing aggregates", async () => {
  const orgId = `test-org-${Date.now()}`;
  const userId = `test-user-${Date.now()}`;
  const featureId = USAGE_FEATURES.INVOICE_CREATE;
  const eventId1 = `test-event-1-${Date.now()}`;
  const eventId2 = `test-event-2-${Date.now()}`;
  
  try {
    // Record first event
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId: eventId1,
    });
    
    // Record second event
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId: eventId2,
    });
    
    // Verify aggregates were incremented
    const now = Timestamp.now();
    const date = now.toDate();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;
    
    const dailyDocId = `${orgId}_${dateStr}_${featureId}_${userId}`;
    const dailyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_DAILY).doc(dailyDocId).get();
    const dailyData = dailyDoc.data();
    assert.strictEqual(dailyData?.totalCount, 2, "Daily aggregate should be incremented");
    
    const monthlyDocId = `${orgId}_${monthStr}_${featureId}`;
    const monthlyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_MONTHLY).doc(monthlyDocId).get();
    const monthlyData = monthlyDoc.data();
    assert.strictEqual(monthlyData?.totalCount, 2, "Monthly aggregate should be incremented");
  } finally {
    await cleanupTestData(orgId, featureId);
  }
});

test("Record usage event - idempotency prevents double-counting", async () => {
  const orgId = `test-org-${Date.now()}`;
  const userId = `test-user-${Date.now()}`;
  const featureId = USAGE_FEATURES.INVOICE_CREATE;
  const eventId = `test-event-${Date.now()}`;
  
  try {
    // Record event first time
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId,
    });
    
    // Record same event again (should be idempotent)
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId,
    });
    
    // Verify aggregate was NOT incremented (still 1)
    const now = Timestamp.now();
    const date = now.toDate();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    const dailyDocId = `${orgId}_${dateStr}_${featureId}_${userId}`;
    const dailyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_DAILY).doc(dailyDocId).get();
    const dailyData = dailyDoc.data();
    assert.strictEqual(dailyData?.totalCount, 1, "Idempotent call should not increment count");
  } finally {
    await cleanupTestData(orgId, featureId, eventId);
  }
});

test("Record usage event - aggregates metadata correctly", async () => {
  const orgId = `test-org-${Date.now()}`;
  const userId = `test-user-${Date.now()}`;
  const featureId = USAGE_FEATURES.WORKFLOW_ACTION_HTTP_REQUEST;
  const eventId1 = `test-event-1-${Date.now()}`;
  const eventId2 = `test-event-2-${Date.now()}`;
  
  try {
    // Record first event with metadata
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId: eventId1,
      metadata: {
        sizeBytes: 1000,
        durationMs: 500,
      },
    });
    
    // Record second event with metadata
    await recordUsageEvent({
      orgId,
      userId,
      featureId,
      eventId: eventId2,
      metadata: {
        sizeBytes: 2000,
        durationMs: 300,
      },
    });
    
    // Verify aggregates sum metadata
    const now = Timestamp.now();
    const date = now.toDate();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    const dailyDocId = `${orgId}_${dateStr}_${featureId}_${userId}`;
    const dailyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_DAILY).doc(dailyDocId).get();
    const dailyData = dailyDoc.data();
    assert.strictEqual(dailyData?.summedSizeBytes, 3000, "Should sum sizeBytes");
    assert.strictEqual(dailyData?.summedDurationMs, 800, "Should sum durationMs");
  } finally {
    await cleanupTestData(orgId, featureId);
  }
});

test("Record usage event - handles null userId (system events)", async () => {
  const orgId = `test-org-${Date.now()}`;
  const featureId = USAGE_FEATURES.WORKFLOW_TRIGGER;
  const eventId = `test-event-${Date.now()}`;
  
  try {
    await recordUsageEvent({
      orgId,
      userId: null,
      featureId,
      eventId,
    });
    
    // Verify event was created with null userId
    const eventDoc = await firestore().collection(TEST_COLLECTIONS.EVENTS).doc(eventId).get();
    const eventData = eventDoc.data();
    assert.strictEqual(eventData?.userId, null);
    
    // Verify daily aggregate uses "ALL" sentinel
    const now = Timestamp.now();
    const date = now.toDate();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    const dailyDocId = `${orgId}_${dateStr}_${featureId}_ALL`;
    const dailyDoc = await firestore().collection(TEST_COLLECTIONS.AGGREGATES_DAILY).doc(dailyDocId).get();
    assert.ok(dailyDoc.exists, "Daily aggregate with ALL sentinel should exist");
  } finally {
    await cleanupTestData(orgId, featureId, eventId);
  }
});

