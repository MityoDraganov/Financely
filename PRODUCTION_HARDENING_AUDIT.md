# Production Hardening Audit Report
**Generated:** 2025-01-27  
**Scope:** Complete repository security, scalability, and reliability review

---

## 🔴 P0 - CRITICAL (Blocking Production)

### 1. **SSRF Vulnerability in Workflow HTTP Executor**
**File:** `functions/src/executors/http-request-executor.ts:22-100`

**Issue:**
```typescript
// Resolve template variables in URL and config
const resolvedConfig = this.resolveTemplateVariables(config, context);

// Make the HTTP request
const response = await fetch(resolvedConfig.url, requestOptions);
```

**Why it's a problem:**
- Workflows can make HTTP requests to ANY URL
- No URL validation or whitelist
- Can access internal services (localhost, 10.x.x.x, 192.168.x.x)
- Can be used for port scanning
- Can access cloud metadata endpoints (169.254.169.254)
- Can be used to exfiltrate data

**Recommended fix:**
```typescript
// Validate URL
const url = new URL(resolvedConfig.url);

// Block private IPs
const privateRanges = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^localhost$/,
];

const hostname = url.hostname;
if (privateRanges.some(range => range.test(hostname))) {
  throw new Error("Private IP addresses are not allowed");
}

// Optional: Whitelist allowed domains
const allowedDomains = process.env.ALLOWED_HTTP_DOMAINS?.split(",") || [];
if (allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
  throw new Error(`Domain ${hostname} is not in allowed list`);
}
```

**Priority:** P0

---

### 2. **XSS Risk - dangerouslySetInnerHTML Usage**
**Files:**
- `app/src/components/onboarding/onboarding-flow.tsx:1048,1156,1280,1334`
- `app/src/components/email-designer/email-designer-canvas.tsx:1155,1547`
- `app/src/components/site-builder/ai-chat-builder.tsx:962,967`

**Issue:**
```typescript
dangerouslySetInnerHTML={{ __html: t("onboarding.createOrg.proTip") }}
```

**Why it's a problem:**
- If translation strings contain user input or are compromised, XSS can occur
- Email templates can contain malicious scripts
- Site builder HTML can execute scripts in admin context

**Recommended fix:**
```typescript
// Use DOMPurify to sanitize HTML
import DOMPurify from 'dompurify';

<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(t("onboarding.createOrg.proTip")) 
}} />

// Or better: Use React components instead of raw HTML
```

**Priority:** P0

---

### 3. **Public Cloud Functions Without Rate Limiting**
**Files:**
- `functions/src/functions/submit-widget-form.ts:65-377`
- `functions/src/functions/store-analytics-event.ts:11-82`
- `functions/src/functions/get-widget-config.ts`
- `functions/src/functions/get-analytics-config.ts`

**Issue:**
```typescript
invoker: "public",
ingressSettings: "ALLOW_ALL",
```
These functions are publicly accessible without:
- Rate limiting
- Request size limits
- Input validation limits
- Abuse detection

**Why it's a problem:**
- `submitWidgetForm` can be spammed to create unlimited contacts/leads
- `storeAnalyticsEvent` can be flooded with fake events, exhausting Firestore writes
- No protection against DDoS or resource exhaustion attacks
- Can cause quota exhaustion and cost spikes

**Recommended fix:**
```typescript
// Add rate limiting middleware
import { rateLimiter } from "../middleware/rate-limiter";

// In function config:
rateLimits: {
  maxRequests: 100, // per IP per minute
  maxRequestsPerOrg: 1000, // per orgId per hour
}

// Add request size validation
if (JSON.stringify(request.body).length > 100000) {
  throw new HttpsError("invalid-argument", "Request too large");
}

// Add input sanitization
const sanitizedOrgId = String(orgId).trim().substring(0, 100);
```

**Priority:** P0

---

### 4. **Missing Authentication in Critical Functions**
**Files:**
- `functions/src/functions/publish-brand-site.ts:75-79`
- `functions/src/functions/upload-file.ts:43-46`
- `functions/src/functions/generate-site.ts` (implicit via onCall but no explicit check)

**Issue:**
```typescript
// TODO: Add authentication check
// const auth = request.auth;
// if (!auth) {
//   throw new HttpsError("unauthenticated", "User must be authenticated");
// }
```

**Why it's a problem:**
- Anyone can publish brand sites, upload files, generate sites
- Can exhaust Cloudflare R2 storage, DNS quotas
- Can create unlimited sites, hitting hosting quotas
- No audit trail for malicious actions

**Recommended fix:**
```typescript
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

const authResult = await verifyAuthAndOrgMembership(request, brandSite.organizationId, {
  requiredRole: "admin"
});
```

**Priority:** P0

---

### 5. **Unscaled Real-time Listeners - Client-Side Filtering**
**Files:**
- `app/src/repositories/template-realtime-repository.ts:95-116`
- `app/src/repositories/email-template-realtime-repository.ts:108-156`

**Issue:**
```typescript
// Subscribe to all templates and filter client-side
// This avoids index requirements and is fine for small datasets
return realtimeDatabaseService.subscribeToCollection<Template>(
  TEMPLATES_PATH,
  (allTemplates: Template[] | null) => {
    // Filter by orgId client-side
    const filtered = allTemplates.filter(t => t && t.orgId === orgId);
    callback(filtered);
  }
);
```

**Why it's a problem:**
- Subscribes to ALL templates across ALL organizations
- Downloads entire dataset to client, then filters
- As organizations grow, this becomes exponentially expensive
- Real-time Database bandwidth costs scale with total data, not filtered data
- Privacy risk: client receives data from other orgs (filtered but still transmitted)

**Recommended fix:**
- Use Firestore with proper indexes instead of Realtime DB
- Or use Realtime DB with org-scoped paths: `templates/{orgId}/{templateId}`
- Add pagination and limits

**Priority:** P0

---

### 6. **Firestore Rules - Missing Field Validation**
**File:** `firestore.rules`

**Issue:**
Rules check organization membership but don't validate:
- Field types (strings, numbers, arrays)
- Field lengths (prevent DoS via huge strings)
- Required fields are present
- Enum values (status, role, etc.)
- Data structure integrity

**Why it's a problem:**
- Malicious users can write invalid data that breaks application logic
- Large strings can cause performance issues
- Missing required fields cause runtime errors
- Invalid enum values break business logic

**Recommended fix:**
```firestore
match /invoices/{invoiceId} {
  allow create: if isAuthenticated() && 
                   request.resource.data.orgId != null &&
                   isOrgMember(request.resource.data.orgId) &&
                   // Add validation
                   request.resource.data.orgId is string &&
                   request.resource.data.orgId.size() < 100 &&
                   request.resource.data.status in ["draft", "sent", "paid", "overdue"] &&
                   request.resource.data.data is map;
}
```

**Priority:** P0

---

### 7. **Multi-Tenancy Data Leak - Invoice Query Without Org Filter**
**File:** `app/src/hooks/repository-hooks/use-invoices.ts:20-22`

**Issue:**
```typescript
return invoiceRepository.getAll({
  orderBy: { field: "updatedAt", direction: "desc" }
});
```

**Why it's a problem:**
- If `orgId` is undefined/null, fetches ALL invoices from ALL organizations
- Firestore rules should block this, but defense-in-depth is critical
- If rules are misconfigured, data leak occurs

**Recommended fix:**
```typescript
if (!orgId) {
  throw new Error("orgId is required");
}
// Remove the fallback getAll() call
```

**Priority:** P0

---

## 🟠 P1 - HIGH (Fix Before Scale)

### 6. **Missing Firestore Composite Indexes**
**Files:**
- `functions/src/services/workflow-execution-engine.ts:136-141`
- `app/src/hooks/useInvites.ts:58-62`
- `functions/src/repositories/audit-log-repository.ts:62-205`

**Issue:**
```typescript
// Workflows query - 3 where clauses
.where("orgId", "==", tenantId)
.where("status", "==", "active")
.where("trigger.type", "==", triggerType)

// Invites query - where + orderBy
.where("organizationId", "==", currentOrganization.id)
.orderBy("createdAt", "desc")

// Audit logs - multiple filter combinations
```

**Why it's a problem:**
- Queries will fail at scale without indexes
- Performance degrades exponentially as data grows
- Production will break when indexes are missing

**Recommended fix:**
Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "workflows",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "orgId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "trigger.type", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "invites",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Priority:** P1

---

### 7. **Site Builder - No Rate Limits on Site Generation**
**Files:**
- `functions/src/functions/generate-site.ts:42-100`
- `functions/src/functions/chat-generate-site.ts`
- `functions/src/app/handle-generate-site-init.ts:67-199`

**Issue:**
No limits on:
- Sites per organization
- Sites per user per day
- Concurrent site generations
- AI API calls per organization

**Why it's a problem:**
- Single user can exhaust:
  - Gemini API quota
  - Cloudflare DNS quota (36 sites per project default)
  - R2 storage quota
  - Firebase Hosting quota
- Can cause service degradation for all users
- High costs from unlimited AI generation

**Recommended fix:**
```typescript
// Check organization limits
const orgLimits = await getOrganizationLimits(organizationId);
if (orgLimits.sitesCreated >= orgLimits.maxSites) {
  throw new HttpsError("resource-exhausted", "Site limit reached");
}

// Check rate limits
const recentSites = await countRecentSites(organizationId, "1h");
if (recentSites >= 10) {
  throw new HttpsError("resource-exhausted", "Too many sites created recently");
}
```

**Priority:** P1

---

### 8. **Widget Form Submission - Inefficient Contact Lookup**
**File:** `functions/src/functions/submit-widget-form.ts:180-213`

**Issue:**
```typescript
const allContacts = await contactRepository.getAll({
  queryConstraints: [
    { field: "organizationId", operator: "==", value: organizationId }
  ],
});

// Then loops through ALL contacts to find match
for (const contact of allContacts) {
  const contactEmail = (contactData.email || "").trim().toLowerCase();
  if (contactEmail === emailNormalized) {
    existingContact = contact;
    break;
  }
}
```

**Why it's a problem:**
- Fetches ALL contacts for organization into memory
- O(n) linear search instead of indexed query
- As contacts grow (10k+), this becomes very slow and expensive
- Can cause function timeouts

**Recommended fix:**
```typescript
// Use indexed query instead
const existingContacts = await contactRepository.getAll({
  queryConstraints: [
    { field: "organizationId", operator: "==", value: organizationId },
    { field: "email", operator: "==", value: emailNormalized }
  ],
  limit: 1
});

const existingContact = existingContacts[0] || null;
```

**Priority:** P1

---

### 9. **Analytics Event Storage - No Input Validation**
**File:** `functions/src/functions/store-analytics-event.ts:28-60`

**Issue:**
```typescript
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
  ...otherParams  // ⚠️ Accepts ANY additional params
} = req.body;

const eventData = {
  org_id: orgId,
  // ... other fields
  ...otherParams,  // ⚠️ Spreads untrusted data
};
```

**Why it's a problem:**
- Accepts unlimited additional parameters
- No size validation on request body
- Can inject arbitrary fields into Firestore
- Can cause schema pollution
- No validation on field types/lengths

**Recommended fix:**
```typescript
// Whitelist allowed fields
const allowedFields = ["orgId", "event", "siteId", "brandName", "pagePath", "pageTitle", "referrer", "clientId", "userAgent"];
const sanitizedData: Record<string, unknown> = {};

for (const field of allowedFields) {
  if (req.body[field] !== undefined) {
    sanitizedData[field] = String(req.body[field]).substring(0, 1000); // Limit length
  }
}

// Validate required fields
if (!sanitizedData.orgId || !sanitizedData.event) {
  res.status(400).json({ error: "orgId and event are required" });
  return;
}
```

**Priority:** P1

---

### 10. **Missing Error Handling in Critical Paths**
**Files:**
- `functions/src/app/handle-generate-site.ts:554-1847` (large try-catch but some paths missing)
- `functions/src/services/workflow-execution-engine.ts:350-561`

**Issue:**
Some async operations lack try-catch:
- DNS operations
- R2 uploads
- AI API calls
- Firestore writes

**Why it's a problem:**
- Unhandled errors crash functions
- Partial state updates (some operations succeed, others fail)
- No retry logic for transient failures
- Poor error messages for debugging

**Recommended fix:**
- Wrap all external API calls in try-catch
- Implement retry logic with exponential backoff
- Use transaction-like patterns for multi-step operations
- Add comprehensive error logging

**Priority:** P1

---

## 🟡 P2 - MEDIUM (Performance & Reliability)

### 11. **Console.log Statements in Production Code**
**Files:**
- `functions/src/services/database-service.ts:249,273,318,410`
- `app/src/repositories/template-realtime-repository.ts:96,108,112`
- Multiple files with `console.log` instead of proper logging

**Issue:**
```typescript
console.log(`Creating document in collection ${collectionName}`, data);
```

**Why it's a problem:**
- Console.log is synchronous and blocks execution
- No log levels (debug/info/warn/error)
- Can't filter or search logs effectively
- Performance impact in production

**Recommended fix:**
```typescript
import { logger } from "firebase-functions";

logger.debug("Creating document", { collectionName, data });
```

**Priority:** P2

---

### 12. **Firestore Rules - Inconsistent Field Names**
**File:** `firestore.rules`

**Issue:**
Rules check both `orgId` and `organizationId`:
```firestore
function belongsToOrg(orgId) {
  return resource.data.orgId == orgId || 
         resource.data.organizationId == orgId;
}
```

**Why it's a problem:**
- Inconsistent data model
- Harder to maintain
- Potential for bugs if one field is missing
- Confusing for developers

**Recommended fix:**
- Standardize on one field name (`organizationId`)
- Migrate existing data
- Update all rules to use single field

**Priority:** P2

---

### 13. **Missing Input Size Limits**
**Files:**
- `functions/src/functions/publish-brand-site.ts:64` (html parameter)
- `functions/src/functions/upload-file.ts:40` (fileData)
- `functions/src/functions/submit-widget-form.ts:79` (data object)

**Issue:**
No validation on:
- HTML size (can be gigabytes)
- File upload size (only content-type check)
- Form data size

**Why it's a problem:**
- Can exhaust function memory
- Can cause timeouts
- High costs for large uploads
- DoS vector

**Recommended fix:**
```typescript
// Validate HTML size
if (html.length > 10 * 1024 * 1024) { // 10MB limit
  throw new HttpsError("invalid-argument", "HTML too large (max 10MB)");
}

// Validate file size
const fileSize = Buffer.byteLength(fileData, 'base64');
if (fileSize > 5 * 1024 * 1024) { // 5MB limit
  throw new HttpsError("invalid-argument", "File too large (max 5MB)");
}
```

**Priority:** P2

---

### 14. **Storage Rules - Public Read Access**
**File:** `storage.rules:14,30,39`

**Issue:**
```firestore
match /organizations/{orgId}/branding/{fileName} {
  allow read: if true; // Public read access
}
```

**Why it's a problem:**
- Anyone can access branding assets if they know the path
- No rate limiting on downloads
- Can be used for hotlinking/bandwidth theft
- Privacy concern if sensitive images uploaded

**Recommended fix:**
```firestore
match /organizations/{orgId}/branding/{fileName} {
  // Only allow read if user is authenticated OR if accessing via brand site
  allow read: if isAuthenticated() || 
                 request.resource.metadata.brandSiteId != null;
}
```

**Priority:** P2

---

### 15. **Missing Query Limits**
**Files:**
- `functions/src/services/database-service.ts:121-144` (getAll without default limit)
- `app/src/repositories/template-realtime-repository.ts:100` (no limit on subscription)

**Issue:**
Queries can return unlimited results:
```typescript
async getAll<T>(...) {
  // No default limit
  if (paginationOptions.limit) {
    query = query.limit(paginationOptions.limit);
  }
}
```

**Why it's a problem:**
- Can fetch millions of documents
- High memory usage
- Slow responses
- High costs

**Recommended fix:**
```typescript
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const limit = Math.min(
  paginationOptions.limit || DEFAULT_LIMIT,
  MAX_LIMIT
);
query = query.limit(limit);
```

**Priority:** P2

---

### 16. **Workflow Execution - No Timeout Protection**
**File:** `functions/src/services/workflow-execution-engine.ts:350-561`

**Issue:**
Workflow steps can run indefinitely:
- HTTP requests without timeout
- AI API calls without timeout
- No overall workflow execution timeout

**Why it's a problem:**
- Functions can timeout (540s max)
- Resources held for long periods
- No way to cancel stuck workflows
- Cost accumulation

**Recommended fix:**
```typescript
// Add timeout to each step
const stepTimeout = 30000; // 30 seconds per step
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error("Step timeout")), stepTimeout);
});

await Promise.race([
  executeStep(step, context),
  timeoutPromise
]);
```

**Priority:** P2

---

## 🟢 P3 - NICE TO HAVE (Code Quality)

### 17. **TODO Comments - Repository Pattern Migration**
**File:** `app/src/hooks/useInvites.ts:52-54`

**Issue:**
```typescript
// TODO: Use repository pattern instead of direct function calls
// For now, we'll use a direct Firestore query
```

**Why it's a problem:**
- Inconsistent data access patterns
- Harder to maintain
- Bypasses validation/security layers

**Recommended fix:**
- Migrate to repository pattern
- Remove direct Firestore queries

**Priority:** P3

---

### 18. **Inconsistent Error Messages**
**Files:** Multiple

**Issue:**
Error messages vary in format and detail:
- Some include stack traces
- Some are user-friendly
- Some are technical

**Why it's a problem:**
- Poor user experience
- Harder to debug
- Inconsistent API responses

**Recommended fix:**
- Standardize error format
- Use error codes
- Separate user-facing vs. technical messages

**Priority:** P3

---

### 19. **Missing Type Safety**
**Files:**
- `functions/src/services/workflow-execution-engine.ts:39` (`Map<string, any>`)
- Multiple `any` types throughout codebase

**Issue:**
```typescript
private actionExecutors: Map<string, any> = new Map()
```

**Why it's a problem:**
- Runtime errors instead of compile-time
- Harder to refactor
- Type safety benefits lost

**Recommended fix:**
- Replace `any` with proper types
- Use generics where appropriate
- Enable strict TypeScript checks

**Priority:** P3

---

### 20. **Missing Unit Tests**
**Files:** Most service and repository files

**Issue:**
- No test files found for critical business logic
- No validation of edge cases
- No regression protection

**Why it's a problem:**
- Bugs can slip into production
- Harder to refactor safely
- No documentation of expected behavior

**Recommended fix:**
- Add unit tests for:
  - Repository methods
  - Service business logic
  - Validation functions
  - Error handling paths

**Priority:** P3

---

## Summary

**Total Issues Found:** 22
- **P0 (Critical):** 7 issues - Fix immediately
- **P1 (High):** 5 issues - Fix before scale
- **P2 (Medium):** 6 issues - Fix for performance
- **P3 (Nice to have):** 4 issues - Code quality improvements

**Key Areas:**
1. **Security:** Public functions, missing auth, data leaks
2. **Scalability:** Missing indexes, inefficient queries, no rate limits
3. **Reliability:** Missing error handling, timeouts, input validation
4. **Cost Control:** No quotas, unlimited operations, inefficient patterns

**Recommended Action Plan:**
1. Week 1: Fix all P0 issues
2. Week 2: Fix all P1 issues
3. Week 3: Fix P2 issues (prioritize based on usage)
4. Ongoing: Address P3 issues during regular development

