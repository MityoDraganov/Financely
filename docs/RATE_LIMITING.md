# Rate Limiting Documentation

## Overview

Rate limiting is implemented across all public Cloud Functions to prevent abuse, quota exhaustion, and cost spikes. The system uses Firestore-backed rate limiting with configurable per-IP and per-organization limits.

## Current Rate Limits

### submit-widget-form

**Purpose**: Widget form submission endpoint (contact forms, invoice requests, quote requests)

- **Per IP Address**: 
  - 30 requests per 5 minutes (300 seconds)
  - Window: Rolling 5-minute window
  
- **Per Organization**:
  - 500 requests per hour (3600 seconds)
  - Window: Rolling 1-hour window

**Rationale**: Form submissions should be moderate in frequency. Per-IP limit prevents spam from single sources, while per-org limit allows legitimate high-volume organizations while still preventing abuse.

---

### store-analytics-event

**Purpose**: Analytics event storage endpoint

- **Per IP Address**:
  - 100 requests per minute (60 seconds)
  - Window: Rolling 1-minute window
  
- **Per Organization**:
  - 10,000 requests per hour (3600 seconds)
  - Window: Rolling 1-hour window

**Rationale**: Analytics events can be high-frequency but should be compact. Stricter per-IP limit (1-minute window) prevents rapid-fire abuse, while per-org limit accommodates legitimate high-volume analytics tracking.

**Special Behavior**: When org-level limits are exceeded, events are **sampled** (10% kept) instead of hard-failing. This protects Firestore while allowing some events through.

---

### get-widget-config

**Purpose**: Widget configuration retrieval endpoint

- **Per IP Address**:
  - 60 requests per minute (60 seconds)
  - Window: Rolling 1-minute window
  
- **Per Organization**:
  - 1,000 requests per hour (3600 seconds)
  - Window: Rolling 1-hour window

**Rationale**: Config endpoints are read-only and should be cached. Limits prevent excessive Firestore reads while allowing reasonable refresh rates.

**Caching**: Responses are cached in-memory for 5 minutes to reduce Firestore load.

---

### get-analytics-config

**Purpose**: Analytics configuration retrieval endpoint

- **Per IP Address**:
  - 60 requests per minute (60 seconds)
  - Window: Rolling 1-minute window
  
- **Per Organization**:
  - 1,000 requests per hour (3600 seconds)
  - Window: Rolling 1-hour window

**Rationale**: Same as widget config - read-only endpoint with caching to reduce load.

**Caching**: Responses are cached in-memory for 5 minutes to reduce Firestore load.

---

## How Rate Limiting Works

### Architecture

Rate limiting uses **Firestore** as the backing store for tracking request counts. Each rate limit key is stored as a document in the `rateLimits` collection:

- **Document ID Format**: `{functionName}:{type}:{identifier}`
  - Example: `submit-widget-form:ip:abc123` (for IP-based limit)
  - Example: `submit-widget-form:org:org-xyz` (for org-based limit)

- **Document Structure**:
  ```typescript
  {
    count: number,           // Current request count in window
    windowStart: number,     // Timestamp when window started (milliseconds)
    expiresAt: Date          // When document should be deleted (for cleanup)
  }
  ```

### Window Calculation

Rate limit windows are calculated using **rolling windows**:

1. Window start is calculated as: `Math.floor(now / windowMs) * windowMs`
2. If current request is in a new window, count resets to 1
3. If current request is in same window, count increments
4. When count exceeds `maxRequests`, request is denied

### Enforcement Flow

```
Request → Extract IP/OrgID → Check Rate Limits → Allow/Deny
```

1. **IP Extraction**: Extracts IP from headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, etc.)
2. **Rate Limit Check**: Checks both per-IP and per-org limits (if applicable)
3. **Decision**: If **any** limit is exceeded, request is denied
4. **Response**: Returns HTTP 429 with `retryAfter` seconds

### Rate Limit Result

When a rate limit check is performed, the result includes:

```typescript
{
  allowed: boolean,      // Whether request should be allowed
  remaining: number,    // Remaining requests in current window
  resetIn: number,       // Seconds until window resets
  limitType?: "perIp" | "perOrg"  // Which limit was exceeded (if any)
}
```

## Error Responses

### Rate Limit Exceeded (HTTP 429)

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 300
}
```

- **Status Code**: 429 Too Many Requests
- **retryAfter**: Number of seconds until the rate limit window resets
- **Headers**: Standard HTTP 429 response headers

### Example Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "retryAfter": 180
}
```

## Configuration

### Location

Rate limits are configured in: `functions/src/middleware/rate-limit-config.ts`

### Configuration Structure

```typescript
export const RATE_LIMIT_CONFIG: Record<string, FunctionRateLimitConfig> = {
  "submit-widget-form": {
    perIp: {
      maxRequests: 30,
      windowSeconds: 300,  // 5 minutes
    },
    perOrg: {
      maxRequests: 500,
      windowSeconds: 3600,  // 1 hour
    },
  },
  // ... other functions
};
```

### Adjusting Limits

To change rate limits:

1. **Edit** `functions/src/middleware/rate-limit-config.ts`
2. **Modify** the `maxRequests` or `windowSeconds` values
3. **Rebuild** and **redeploy** functions

**Example**: Increase widget form per-IP limit to 60 requests per 5 minutes:

```typescript
"submit-widget-form": {
  perIp: {
    maxRequests: 60,  // Changed from 30
    windowSeconds: 300,
  },
  // ...
}
```

### Adding New Functions

To add rate limiting to a new function:

1. **Add entry** to `RATE_LIMIT_CONFIG`:

```typescript
"new-function-name": {
  perIp: {
    maxRequests: 50,
    windowSeconds: 60,
  },
  perOrg: {
    maxRequests: 1000,
    windowSeconds: 3600,
  },
},
```

2. **Import** rate limiter in your function:

```typescript
import { getRateLimiter, extractIpFromRequest } from "../middleware";
```

3. **Check limits** before processing:

```typescript
const rateLimiter = getRateLimiter();
const ipAddress = extractIpFromRequest(request);
const result = await rateLimiter.checkLimit("new-function-name", ipAddress, orgId);

if (!result.allowed) {
  response.status(429).json({
    error: "Rate limit exceeded",
    retryAfter: result.resetIn,
  });
  return;
}
```

## Monitoring & Logging

### Log Events

Rate limiting generates structured logs:

#### Rate Limit Exceeded (Warning)

```json
{
  "severity": "WARNING",
  "message": "Rate limit exceeded",
  "functionName": "submit-widget-form",
  "limitType": "perIp",
  "ipHash": "abc123",
  "orgId": "org-xyz",
  "resetIn": 180
}
```

#### Rate Limit Approaching (Info)

Logged when remaining requests < 10:

```json
{
  "severity": "INFO",
  "message": "Rate limit approaching",
  "functionName": "store-analytics-event",
  "remaining": 5,
  "resetIn": 45,
  "ipHash": "abc123",
  "orgId": "org-xyz"
}
```

### Monitoring Queries

To monitor rate limit hits in Firestore:

```javascript
// Count rate limit documents (active windows)
db.collection("rateLimits")
  .where("count", ">", 0)
  .get()
  .then(snapshot => console.log(`Active rate limit windows: ${snapshot.size}`));

// Find exceeded limits
db.collection("rateLimits")
  .where("count", ">", 30)  // Adjust threshold per function
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      console.log(`Exceeded: ${doc.id}, count: ${doc.data().count}`);
    });
  });
```

## Firestore Collections

### rateLimits Collection

- **Collection**: `rateLimits`
- **Document ID**: `{functionName}:{type}:{identifier}`
- **Fields**:
  - `count` (number): Current request count
  - `windowStart` (number): Window start timestamp (ms)
  - `expiresAt` (Date): Document expiration (for cleanup)
- **TTL**: Documents expire after 2x window duration (automatic cleanup)

### duplicateSubmissions Collection

Used for duplicate form submission detection (separate from rate limiting):

- **Collection**: `duplicateSubmissions`
- **Document ID**: `{orgId}:{ipHash}:{payloadHash}`
- **TTL**: 120 seconds (2x default window)

## Best Practices

### For Developers

1. **Handle 429 responses gracefully**: Implement exponential backoff in clients
2. **Cache config responses**: Use HTTP cache headers to reduce requests
3. **Batch operations**: Combine multiple operations when possible
4. **Monitor your usage**: Check logs to understand your request patterns

### For Administrators

1. **Monitor rate limit hits**: Set up alerts for excessive 429 responses
2. **Adjust limits as needed**: Tune limits based on actual usage patterns
3. **Review Firestore costs**: Rate limit documents are lightweight but monitor collection size
4. **Set up TTL policies**: Configure Firestore TTL for automatic cleanup (optional)

## Troubleshooting

### "Rate limit exceeded" but I haven't made many requests

**Possible causes**:
- Shared IP address (corporate proxy, VPN, etc.)
- Organization-level limit exceeded by other users
- Stale rate limit documents (should auto-expire)

**Solutions**:
- Check if you're behind a proxy/VPN
- Verify organization-level usage
- Wait for window to reset (check `retryAfter` in response)

### Rate limits too strict for legitimate use

**Solution**: Adjust limits in `rate-limit-config.ts` and redeploy. Consider:
- Increasing `maxRequests` for the function
- Increasing `windowSeconds` to allow more burst traffic
- Adding per-org limits if not present

### Rate limits not working

**Check**:
1. Function name matches config key exactly
2. Rate limiter is called before processing
3. Firestore permissions allow writes to `rateLimits` collection
4. No errors in function logs

## Advanced Features

### Event Sampling (store-analytics-event)

When org-level limits are exceeded, events are sampled instead of hard-failing:

- **Sample Rate**: 10% of events are kept
- **Deterministic**: Same org always gets same sampling (based on orgId hash)
- **Logging**: Sampled events are logged for monitoring

This protects Firestore from excessive writes while maintaining some data flow.

### IP Hashing

IP addresses are hashed before storage for privacy:

- **Purpose**: Privacy-safe logging and rate limiting
- **Method**: Simple hash function (not cryptographic)
- **Storage**: Only hash stored, not full IP

### Config Caching

Config endpoints (`get-widget-config`, `get-analytics-config`) use in-memory caching:

- **TTL**: 5 minutes
- **Benefit**: Reduces Firestore reads
- **Headers**: HTTP cache headers set for CDN/browser caching

## Request Size Limits

In addition to rate limiting, request size limits are enforced:

- **submit-widget-form**: 50 KB
- **store-analytics-event**: 10 KB
- **get-widget-config**: 1 KB
- **get-analytics-config**: 1 KB

See `REQUEST_SIZE_LIMITS` in `rate-limit-config.ts` for configuration.

## Related Documentation

- [Public Functions Hardening](./PUBLIC_FUNCTIONS_HARDENING.md) - Complete security hardening guide
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions) - Official Firebase docs

## Support

For questions or issues with rate limiting:

1. Check function logs in Firebase Console
2. Review Firestore `rateLimits` collection
3. Verify configuration in `rate-limit-config.ts`
4. Contact development team with specific function name and error details

