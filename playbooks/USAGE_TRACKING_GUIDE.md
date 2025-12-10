# Usage Tracking Guide

Comprehensive guide for implementing usage tracking in Financely features.

## Overview

Usage tracking is essential for:
- **Billing & Quotas**: Track feature usage for subscription limits
- **Analytics**: Understand how features are used
- **Cost Attribution**: Identify expensive operations
- **Product Insights**: See which features drive value

## Architecture

### Data Model

```
usage_events (raw events)
  ↓
usage_aggregates_daily (daily rollups)
  ↓
usage_aggregates_monthly (monthly rollups)
```

### Collections

1. **`usage_events`** - Append-only raw events
   - One document per usage event
   - Document ID: `eventId` (for idempotency)

2. **`usage_aggregates_daily`** - Daily aggregates
   - Document ID: `<orgId>_<YYYY-MM-DD>_<featureId>_<userId-or-ALL>`
   - Aggregates: `totalCount`, `summedSizeBytes`, `summedDurationMs`

3. **`usage_aggregates_monthly`** - Monthly aggregates
   - Document ID: `<orgId>_<YYYY-MM>_<featureId>`
   - Same aggregation fields as daily

## Quick Start

### 1. Add Feature Constant

```typescript
// functions/src/usage/usage-features.ts
export const USAGE_FEATURES = {
  // ... existing
  YOUR_FEATURE_ACTION: "your_feature.action",
} as const;
```

### 2. Record Usage Event

```typescript
import { recordUsageEvent } from "../usage";
import { USAGE_FEATURES } from "../usage/usage-features";

// After successful operation
await recordUsageEvent({
  orgId: "org123",
  userId: "user456", // or null for system events
  featureId: USAGE_FEATURES.YOUR_FEATURE_ACTION,
  metadata: {
    entityId: "entity789",
    context: "api",
  },
});
```

## When to Track

### ✅ Track These

- **User Actions**: Create, update, delete operations
- **Costly Operations**: AI calls, external API calls, file processing
- **Billable Events**: Actions that should count toward quotas
- **Success Only**: After validation and successful completion

### ❌ Don't Track These

- Failed operations
- Read-only operations (unless expensive)
- Internal system operations (unless billable)
- UI interactions (keystrokes, clicks)
- Polling/checking operations

## Feature ID Naming

### Format

```
<domain>.<action>
<domain>.<subdomain>.<action>
```

### Examples

```typescript
// Simple
"invoice.create"
"proposal.send"

// With subdomain
"ai.site_builder.generate"
"workflow.action.http_request"

// Specific actions
"invoice.send_email"
"invoice.download_pdf"
```

### Rules

- Use lowercase
- Use underscores for multi-word parts
- Be specific: `workflow.action.email` not `workflow.email`
- Group related features: `ai.*` for all AI features

## Tracking Patterns

### Pattern 1: Simple Create

```typescript
const entityId = await repository.create({ data });

await recordUsageEvent({
  orgId: payload.orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.ENTITY_CREATE,
  metadata: {
    entityId,
    context: "api",
  },
});
```

### Pattern 2: With Duration

```typescript
const startTime = Date.now();
const result = await expensiveOperation();
const durationMs = Date.now() - startTime;

await recordUsageEvent({
  orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.EXPENSIVE_OPERATION,
  metadata: {
    entityId: result.id,
    context: "api",
    durationMs,
  },
});
```

### Pattern 3: With Size

```typescript
const fileSize = fileBuffer.length;

await recordUsageEvent({
  orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.FILE_UPLOAD,
  metadata: {
    entityId: fileId,
    context: "api",
    sizeBytes: fileSize,
  },
});
```

### Pattern 4: System-Triggered

```typescript
// In workflow executor, scheduled job, etc.
await recordUsageEvent({
  orgId: context.orgId,
  userId: null, // System event
  featureId: USAGE_FEATURES.WORKFLOW_ACTION_EMAIL,
  metadata: {
    context: "automation",
  },
});
```

### Pattern 5: External User

```typescript
// Widget submission, public endpoint
await recordUsageEvent({
  orgId: organizationId,
  userId: null, // External user, no auth
  featureId: USAGE_FEATURES.WIDGET_FORM_SUBMIT,
  metadata: {
    context: "widget",
    payloadType: widgetType,
  },
});
```

## Metadata Fields

### Standard Fields

```typescript
metadata: {
  // Entity reference
  entityId?: string;              // Related entity ID
  
  // Context
  context?: string;               // "api", "automation", "widget", "site-builder"
  
  // Performance
  durationMs?: number;            // Operation duration
  sizeBytes?: number;             // Data size
  
  // Type information
  payloadType?: string;           // "invoice", "proposal", "email_template"
  
  // Custom fields
  [key: string]: unknown;
}
```

### Context Values

- `"api"` - User-initiated via API/function
- `"automation"` - System-triggered (workflows, scheduled jobs)
- `"widget"` - External widget/embed
- `"site-builder"` - Site builder UI
- `"editor"` - Content editor

## Idempotency

### Using eventId

```typescript
// For idempotent operations
await recordUsageEvent({
  orgId,
  userId,
  featureId: USAGE_FEATURES.ENTITY_CREATE,
  eventId: `create-${entityId}`, // Unique per operation
  metadata: { entityId },
});
```

**Benefits:**
- Prevents double-counting on retries
- Safe to call multiple times
- Useful for async operations

### Without eventId

```typescript
// System generates UUID
await recordUsageEvent({
  orgId,
  userId,
  featureId: USAGE_FEATURES.ENTITY_CREATE,
  // eventId auto-generated
});
```

## Error Handling

### Best Practice

```typescript
try {
  // Business operation
  const result = await performOperation();
  
  // Record usage (after success)
  try {
    await recordUsageEvent({
      orgId: payload.orgId,
      userId: userContext?.userId || null,
      featureId: USAGE_FEATURES.OPERATION,
      metadata: { entityId: result.id },
    });
  } catch (usageError) {
    // Don't fail business operation if tracking fails
    logger.warn("Failed to record usage event", {
      error: usageError instanceof Error ? usageError.message : String(usageError),
    });
  }
  
  return result;
} catch (error) {
  // Handle business error
  // Don't record usage for failed operations
  throw error;
}
```

**Key Points:**
- ✅ Track only after successful operations
- ✅ Don't let tracking failures break business flows
- ✅ Log tracking errors for monitoring

## Querying Usage Data

### Daily Aggregates

```typescript
// Get daily usage for org and feature
const dailyDoc = await firestore
  .collection("usage_aggregates_daily")
  .doc(`${orgId}_2025-01-15_invoice.create_ALL`)
  .get();

const usage = dailyDoc.data();
// { totalCount: 42, summedSizeBytes: 0, summedDurationMs: 0 }
```

### Monthly Aggregates

```typescript
// Get monthly usage
const monthlyDoc = await firestore
  .collection("usage_aggregates_monthly")
  .doc(`${orgId}_2025-01_invoice.create`)
  .get();
```

### Query Patterns

```typescript
// All daily aggregates for org
const snapshot = await firestore
  .collection("usage_aggregates_daily")
  .where("orgId", "==", orgId)
  .where("date", ">=", startDate)
  .where("date", "<=", endDate)
  .get();

// Usage by feature
const snapshot = await firestore
  .collection("usage_aggregates_daily")
  .where("orgId", "==", orgId)
  .where("featureId", "==", "invoice.create")
  .get();
```

## Common Scenarios

### Scenario 1: Async Operation

**Problem:** Operation starts immediately but completes later.

**Solution:** Track on initiation, optionally track completion.

```typescript
// Initiation
await recordUsageEvent({
  orgId,
  userId,
  featureId: USAGE_FEATURES.SITE_GENERATE,
  eventId: `generate-${siteId}`,
  metadata: { entityId: siteId },
});

// Later, on completion (optional)
await recordUsageEvent({
  orgId,
  userId,
  featureId: USAGE_FEATURES.SITE_GENERATE_COMPLETE,
  eventId: `complete-${siteId}`,
  metadata: { entityId: siteId, durationMs },
});
```

### Scenario 2: Bulk Operations

**Problem:** Processing multiple items in one operation.

**Solution:** Use `count` parameter.

```typescript
await recordUsageEvent({
  orgId,
  userId,
  featureId: USAGE_FEATURES.INVOICE_BATCH_CREATE,
  count: invoiceIds.length, // Track multiple
  metadata: {
    entityIds: invoiceIds,
    context: "api",
  },
});
```

### Scenario 3: Conditional Tracking

**Problem:** Only track in certain conditions.

**Solution:** Add conditional check.

```typescript
if (shouldTrackUsage) {
  await recordUsageEvent({
    orgId,
    userId,
    featureId: USAGE_FEATURES.FEATURE_ACTION,
    metadata: { condition: "premium" },
  });
}
```

## Testing Usage Tracking

### Unit Test Example

```typescript
test("Should record usage event", async () => {
  const orgId = `test-org-${Date.now()}`;
  const eventId = `test-event-${Date.now()}`;
  
  await recordUsageEvent({
    orgId,
    userId: "user123",
    featureId: USAGE_FEATURES.INVOICE_CREATE,
    eventId,
  });
  
  // Verify event created
  const eventDoc = await firestore
    .collection("usage_events")
    .doc(eventId)
    .get();
  
  assert.ok(eventDoc.exists);
  assert.strictEqual(eventDoc.data()?.orgId, orgId);
});
```

## Troubleshooting

### Issue: Events Not Appearing

**Check:**
1. Is Firebase Admin initialized?
2. Are you calling `recordUsageEvent` after success?
3. Are errors being swallowed?
4. Check Firestore rules (should allow backend writes)

### Issue: Double Counting

**Solution:** Use `eventId` for idempotency.

```typescript
await recordUsageEvent({
  // ...
  eventId: `unique-${operationId}`, // Prevents duplicates
});
```

### Issue: Aggregates Not Updating

**Check:**
1. Are transactions completing?
2. Are document IDs correct?
3. Check Firestore logs for errors

## Best Practices Summary

1. ✅ **Track after success** - Only record successful operations
2. ✅ **Use feature constants** - Import from `usage-features.ts`
3. ✅ **Include metadata** - Add relevant context
4. ✅ **Handle errors gracefully** - Don't break business flows
5. ✅ **Use idempotency** - Include `eventId` for retries
6. ✅ **Be consistent** - Follow naming conventions
7. ✅ **Track meaningful actions** - Not every micro-operation
8. ✅ **Include duration/size** - For expensive operations

## Reference

- **Module:** `functions/src/usage/`
- **Types:** `functions/src/usage/usage-types.ts`
- **Features:** `functions/src/usage/usage-features.ts`
- **Tracker:** `functions/src/usage/usage-tracker.ts`
- **Tests:** `functions/src/usage/usage-tracker.test.ts`

---

**Last Updated:** 2025-01-XX








