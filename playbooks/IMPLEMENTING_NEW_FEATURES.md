# Implementing New Features - Developer Playbook

This playbook provides a comprehensive guide for implementing new features in the Financely codebase, covering architecture, patterns, usage tracking, testing, and best practices.

## Table of Contents

1. [Feature Planning](#feature-planning)
2. [Code Structure & Architecture](#code-structure--architecture)
3. [Usage Tracking](#usage-tracking)
4. [Security & Multi-Tenancy](#security--multi-tenancy)
5. [Error Handling & Logging](#error-handling--logging)
6. [Testing Requirements](#testing-requirements)
7. [Documentation Standards](#documentation-standards)
8. [Deployment Checklist](#deployment-checklist)

---

## Feature Planning

### Before You Start

1. **Define the Feature Scope**
   - What problem does it solve?
   - Who are the users (org owners, members, external users)?
   - What are the success criteria?

2. **Identify Integration Points**
   - Which existing services/repositories will you use?
   - Are there similar features you can reference?
   - What new data models are needed?

3. **Consider Multi-Tenancy**
   - How does this feature respect `orgId` boundaries?
   - What role permissions are required?
   - Are there any cross-org operations?

4. **Plan Usage Tracking**
   - What user actions should be tracked?
   - What metadata is valuable for billing/analytics?
   - When should tracking occur (initiation vs completion)?

---

## Code Structure & Architecture

### Backend (Cloud Functions)

#### File Organization

```
functions/src/
├── functions/          # Cloud Function entry points (onCall, onRequest, triggers)
├── app/               # Application handlers (business logic)
├── services/          # Business services (orchestration)
├── repositories/      # Data access layer
├── core/              # Domain entities, types, ports
├── infrastructure/    # External integrations (Firebase, APIs)
├── executors/         # Workflow action executors
├── utils/             # Shared utilities
└── usage/             # Usage tracking module
```

#### Implementation Pattern

1. **Cloud Function** (`functions/src/functions/`)
   - Entry point with validation
   - Auth/authorization checks
   - Calls application handler
   - Records usage events
   - Error handling

2. **Application Handler** (`functions/src/app/`)
   - Pure business logic
   - No Firebase-specific code
   - Uses repositories/services
   - Returns results

3. **Service Layer** (`functions/src/services/`)
   - Orchestrates multiple repositories
   - Complex business rules
   - External API calls

4. **Repository Layer** (`functions/src/repositories/`)
   - Data access only
   - CRUD operations
   - Query building

#### Example Structure

```typescript
// functions/src/functions/create-feature.ts
export const createFeature = onCall<CreateFeatureInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    // 1. Validation
    // 2. Auth check
    // 3. Call handler
    // 4. Record usage
    // 5. Return result
  }
);

// functions/src/app/handle-create-feature.ts
export async function handleCreateFeature(
  payload: CreateFeatureInput
): Promise<string> {
  // Business logic here
  // Use repositories/services
  // Return ID
}

// functions/src/core/entities/feature.ts
export const featureSchema = z.object({
  // Type definitions
});
```

### Frontend (React App)

#### File Organization

```
app/src/
├── pages/             # Page components
├── components/       # Reusable components
├── hooks/             # Custom React hooks
├── services/          # API clients, services
├── core/              # Types, interfaces, ports
└── utils/             # Shared utilities
```

#### Implementation Pattern

1. **Page Component** - Route-level component
2. **Feature Components** - Domain-specific UI
3. **Shared Components** - Reusable UI elements
4. **Hooks** - Data fetching, mutations (React Query)
5. **Services** - API communication

---

## Usage Tracking

### When to Track Usage

**Always track:**
- ✅ User-initiated actions (create, update, delete)
- ✅ Actions that incur cost (AI calls, external API calls, storage)
- ✅ Actions that should be limited (billing/quotas)
- ✅ Successful operations only (after validation and completion)

**Don't track:**
- ❌ Failed operations
- ❌ Read-only operations (unless they're expensive)
- ❌ Internal system operations (unless they're billable)
- ❌ Every keystroke or UI interaction

### How to Add Usage Tracking

#### Step 1: Add Feature Constant

Add your feature to `functions/src/usage/usage-features.ts`:

```typescript
export const USAGE_FEATURES = {
  // ... existing features
  YOUR_FEATURE_CREATE: "your_feature.create",
  YOUR_FEATURE_UPDATE: "your_feature.update",
  YOUR_FEATURE_DELETE: "your_feature.delete",
} as const;
```

**Naming Convention:**
- Format: `<domain>.<action>` or `<domain>.<subdomain>.<action>`
- Use lowercase with underscores: `invoice.create`, `ai.site_builder.generate`
- Be specific: `workflow.action.http_request` not `workflow.http`

#### Step 2: Record Usage in Function

Add usage tracking after successful operations:

```typescript
import { recordUsageEvent } from "../usage";
import { USAGE_FEATURES } from "../usage/usage-features";
import { extractUserContextFromRequest } from "../utils/request-context";

// After successful operation
try {
  const userContext = await extractUserContextFromRequest(request);
  
  await recordUsageEvent({
    orgId: payload.orgId,
    userId: userContext?.userId || null,
    featureId: USAGE_FEATURES.YOUR_FEATURE_CREATE,
    metadata: {
      entityId: resultId,
      context: "api", // or "automation", "widget", "site-builder"
      // Optional: durationMs, sizeBytes, payloadType, etc.
    },
  });
} catch (usageError) {
  // Don't fail the operation if usage tracking fails
  logger.warn("Failed to record usage event", {
    error: usageError instanceof Error ? usageError.message : String(usageError),
  });
}
```

#### Step 3: Choose Tracking Point

**Option A: Track on Initiation** (Recommended for user actions)
- User clicks "Generate Site" → Track immediately
- Pros: Captures user intent, simpler
- Cons: May count failed operations

**Option B: Track on Completion** (Recommended for expensive operations)
- Site generation completes successfully → Track
- Pros: Only counts successful operations
- Cons: May miss user attempts

**Option C: Track Both** (For important features)
- Track initiation with one feature ID
- Track completion with another
- Use different feature IDs to distinguish

#### Step 4: Include Metadata

Include relevant metadata for analytics:

```typescript
metadata: {
  entityId: "invoice123",           // Related entity ID
  context: "api",                    // Where it was triggered
  durationMs: 1500,                 // For time-consuming operations
  sizeBytes: 1024,                  // For storage/transfer operations
  payloadType: "invoice",           // Type of data processed
  // Custom fields as needed
}
```

### Usage Tracking Examples

#### Example 1: Simple Create Operation

```typescript
// After creating invoice
await recordUsageEvent({
  orgId: payload.orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.INVOICE_CREATE,
  metadata: {
    entityId: invoiceId,
    context: "api",
  },
});
```

#### Example 2: AI Operation with Duration

```typescript
const startTime = Date.now();
const result = await aiService.generate(prompt);
const durationMs = Date.now() - startTime;

await recordUsageEvent({
  orgId: organizationId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.AI_EMAIL_TEMPLATE_GENERATE,
  metadata: {
    context: "api",
    durationMs,
    payloadType: "email_template",
  },
});
```

#### Example 3: Workflow Action (System-Triggered)

```typescript
// In workflow executor
await recordUsageEvent({
  orgId: context.orgId,
  userId: null, // System-triggered
  featureId: USAGE_FEATURES.WORKFLOW_ACTION_HTTP_REQUEST,
  metadata: {
    context: "automation",
    durationMs,
  },
});
```

#### Example 4: Widget Submission (External User)

```typescript
// After successful widget form submission
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

---

## Security & Multi-Tenancy

### Multi-Tenant Requirements

**Always:**
1. Extract `orgId` from request or entity
2. Verify user belongs to organization
3. Use `verifyAuthAndOrgMembership()` for auth checks
4. Filter queries by `orgId`
5. Never expose data across organizations

### Authentication & Authorization

```typescript
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";

// In Cloud Function
await verifyAuthAndOrgMembership(request, payload.orgId, {
  requiredRole: ORGANIZATION_ROLES.MEMBER, // or ADMIN, OWNER, VIEWER
});
```

### Input Validation

1. **Validate at Function Entry**
   ```typescript
   if (!payload.orgId) {
     throw new HttpsError("invalid-argument", "orgId is required");
   }
   ```

2. **Use Zod Schemas** (in `core/entities/`)
   ```typescript
   const validatedData = featureSchema.parse(payload);
   ```

3. **Sanitize User Input**
   - HTML content → use sanitizer utilities
   - URLs → use URL validator
   - File uploads → validate size, type, content

### Firestore Security Rules

Update `firestore.rules` for new collections:

```javascript
match /yourCollection/{docId} {
  allow read: if isAuthenticated() && 
                 isOrgMember(resource.data.orgId);
  allow create: if isAuthenticated() && 
                   request.resource.data.orgId != null &&
                   isOrgMember(request.resource.data.orgId) &&
                   hasRole(request.resource.data.orgId, 'member');
  allow update: if isAuthenticated() && 
                   belongsToOrg(resource.data.orgId) &&
                   request.resource.data.orgId == resource.data.orgId &&
                   isOwnerOrAdmin(resource.data.orgId);
  allow delete: if isAuthenticated() && 
                   belongsToOrg(resource.data.orgId) &&
                   isOwnerOrAdmin(resource.data.orgId);
}
```

---

## Error Handling & Logging

### Error Handling Pattern

```typescript
try {
  // Operation
  const result = await performOperation();
  
  // Record usage (after success)
  await recordUsageEvent({...});
  
  return result;
} catch (error) {
  // Log error with context
  loggerService.error("Operation failed", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { orgId, userId, /* relevant context */ },
  });
  
  // Re-throw HttpsError as-is
  if (error instanceof HttpsError) {
    throw error;
  }
  
  // Wrap other errors
  throw new HttpsError(
    "internal",
    `Operation failed: ${error instanceof Error ? error.message : "Unknown error"}`
  );
}
```

### Logging Best Practices

**Use structured logging:**
```typescript
loggerService.info("Operation started", {
  orgId,
  userId,
  operationType: "create",
  // Include relevant context
});

loggerService.error("Operation failed", {
  error: error.message,
  stack: error.stack,
  orgId,
  // Include context for debugging
});
```

**Don't log:**
- ❌ Passwords, tokens, API keys
- ❌ Full user objects (PII)
- ❌ Sensitive business data
- ❌ Excessive detail in production

---

## Testing Requirements

### Unit Tests

**Location:** `functions/src/**/*.test.ts`

**Coverage:**
- Business logic functions
- Utility functions
- Validators
- Transformers

**Example:**
```typescript
import { test } from "node:test";
import assert from "node:assert";

test("Function should validate input", async () => {
  // Arrange
  const input = { /* test data */ };
  
  // Act
  const result = await functionUnderTest(input);
  
  // Assert
  assert.strictEqual(result, expected);
});
```

### Integration Tests

**For usage tracking:**
- Test event creation
- Test aggregate increments
- Test idempotency
- Test metadata aggregation

**Note:** Integration tests require Firebase emulator or test project.

### Frontend Tests

**Location:** `app/src/**/*.test.ts`

**Use Vitest** for React component testing.

---

## Documentation Standards

### Code Comments

**Function-level JSDoc:**
```typescript
/**
 * Creates a new feature entity.
 * 
 * @param payload - Feature creation payload
 * @returns Promise resolving to the created feature ID
 * @throws HttpsError if validation fails or operation fails
 * 
 * @example
 * const featureId = await handleCreateFeature({
 *   orgId: "org123",
 *   name: "My Feature",
 * });
 */
export async function handleCreateFeature(
  payload: CreateFeatureInput
): Promise<string> {
  // Implementation
}
```

**Inline Comments:**
- Explain "why", not "what"
- Document non-obvious logic
- Note edge cases or gotchas

### README Updates

Update relevant README files:
- Feature-specific documentation
- API documentation
- Architecture diagrams (if needed)

---

## Deployment Checklist

Before deploying a new feature:

### Code Quality
- [ ] TypeScript compiles without errors
- [ ] Linter passes (`npm run lint`)
- [ ] All tests pass (`npm run test`)
- [ ] No `any` types (use proper types)
- [ ] No unused imports/variables

### Security
- [ ] Auth/authorization checks in place
- [ ] Input validation implemented
- [ ] Firestore rules updated
- [ ] No secrets in code
- [ ] Rate limiting considered (if public endpoint)

### Usage Tracking
- [ ] Feature constants added
- [ ] Usage events recorded at appropriate points
- [ ] Metadata includes relevant context
- [ ] Tracking doesn't break business flows (try/catch)

### Testing
- [ ] Unit tests written
- [ ] Integration tests written (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases tested

### Documentation
- [ ] Code comments added
- [ ] Function JSDoc complete
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)

### Infrastructure
- [ ] Firestore indexes added (if needed)
- [ ] Firestore rules updated
- [ ] Environment variables documented
- [ ] Secrets configured (if needed)

### Deployment
- [ ] Build succeeds locally
- [ ] Functions deploy successfully
- [ ] Firestore rules deploy successfully
- [ ] Firestore indexes deploy successfully
- [ ] Post-deployment smoke tests pass

---

## Common Patterns

### Pattern: Create Entity

```typescript
// 1. Validate input
const validatedData = entitySchema.parse(payload);

// 2. Check auth
await verifyAuthAndOrgMembership(request, payload.orgId, {
  requiredRole: ORGANIZATION_ROLES.MEMBER,
});

// 3. Create entity
const entityId = await entityRepository.create({ data: validatedData });

// 4. Record usage
await recordUsageEvent({
  orgId: payload.orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.ENTITY_CREATE,
  metadata: { entityId, context: "api" },
});

// 5. Return result
return { id: entityId };
```

### Pattern: Update Entity

```typescript
// 1. Get existing entity
const entity = await entityRepository.get({ id: entityId });
if (!entity) {
  throw new HttpsError("not-found", "Entity not found");
}

// 2. Verify auth and ownership
await verifyAuthAndOrgMembership(request, entity.orgId, {
  requiredRole: ORGANIZATION_ROLES.ADMIN,
});

// 3. Validate update
const validatedData = updateSchema.parse(payload);

// 4. Update entity
await entityRepository.update({ id: entityId, data: validatedData });

// 5. Record usage
await recordUsageEvent({
  orgId: entity.orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.ENTITY_UPDATE,
  metadata: { entityId, context: "api" },
});
```

### Pattern: Async Operation with Status

```typescript
// 1. Create entity with "pending" status
const entityId = await entityRepository.create({
  data: { ...payload, status: "pending" },
});

// 2. Record usage on initiation
await recordUsageEvent({
  orgId: payload.orgId,
  userId: userContext?.userId || null,
  featureId: USAGE_FEATURES.ENTITY_PROCESS,
  metadata: { entityId, context: "api" },
});

// 3. Return immediately
return { id: entityId, status: "pending" };

// 4. Process asynchronously (Firestore trigger)
// 5. Update status to "success" or "failed"
// 6. Optionally record completion usage event
```

---

## Quick Reference

### Import Paths

```typescript
// Usage tracking
import { recordUsageEvent } from "../usage";
import { USAGE_FEATURES } from "../usage/usage-features";

// Auth
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { extractUserContextFromRequest } from "../utils/request-context";
import { ORGANIZATION_ROLES } from "../core/roles";

// Logging
import { loggerService } from "../services/logger-service";

// Repositories
import { getDatabaseService } from "../services/database-service";
import { getEntityRepository } from "../repositories/entity-repository";
```

### Common Feature IDs

```typescript
// Invoice
USAGE_FEATURES.INVOICE_CREATE
USAGE_FEATURES.INVOICE_SEND_EMAIL
USAGE_FEATURES.INVOICE_RENDER_PDF

// Proposal
USAGE_FEATURES.PROPOSAL_CREATE
USAGE_FEATURES.PROPOSAL_SEND
USAGE_FEATURES.PROPOSAL_CONVERT_TO_INVOICE

// AI
USAGE_FEATURES.AI_SITE_BUILDER_GENERATE
USAGE_FEATURES.AI_EMAIL_TEMPLATE_GENERATE
USAGE_FEATURES.AI_INVOICE_TEMPLATE_GENERATE

// Workflow
USAGE_FEATURES.WORKFLOW_TRIGGER
USAGE_FEATURES.WORKFLOW_RUN
USAGE_FEATURES.WORKFLOW_ACTION_HTTP_REQUEST
```

---

## Getting Help

- Check existing similar features for patterns
- Review `functions/src/usage/` for usage tracking examples
- Check `functions/src/functions/` for function patterns
- Review Firestore rules in `firestore.rules`
- Check test files for testing patterns

---

**Last Updated:** 2025-01-XX
**Maintained By:** Development Team






