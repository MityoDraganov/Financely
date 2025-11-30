# Public Cloud Functions Hardening

## Overview

This document describes the security hardening applied to public Cloud Functions to prevent abuse, quota exhaustion, and cost spikes.

## Updated Functions

The following public functions have been hardened:

1. **submit-widget-form** - Widget form submission endpoint
2. **store-analytics-event** - Analytics event storage endpoint
3. **get-widget-config** - Widget configuration retrieval endpoint
4. **get-analytics-config** - Analytics configuration retrieval endpoint

## Security Features Implemented

### 1. Rate Limiting

**Firestore-backed rate limiting** with per-IP and per-org limits:

- **submit-widget-form**:
  - Per-IP: 30 requests per 5 minutes
  - Per-org: 500 requests per hour

- **store-analytics-event**:
  - Per-IP: 100 requests per minute (stricter short window)
  - Per-org: 10,000 requests per hour (high volume analytics)

- **get-widget-config**:
  - Per-IP: 60 requests per minute
  - Per-org: 1,000 requests per hour

- **get-analytics-config**:
  - Per-IP: 60 requests per minute
  - Per-org: 1,000 requests per hour

Rate limit data is stored in Firestore collection `rateLimits` with automatic expiration via TTL.

**Configuration**: `functions/src/middleware/rate-limit-config.ts`

### 2. Request Size Limits

Hard limits on request body size to prevent memory exhaustion:

- **submit-widget-form**: 50 KB
- **store-analytics-event**: 10 KB
- **get-widget-config**: 1 KB (query params only)
- **get-analytics-config**: 1 KB (query params only)

Requests exceeding limits are rejected with HTTP 400.

**Implementation**: `functions/src/middleware/request-size-guard.ts`

### 3. Input Validation & Truncation

Strict validation and normalization of all inputs:

- **Organization IDs**: Validated format, max 100 chars
- **Email addresses**: Format validation, max 255 chars
- **Names**: Truncated to max 200 chars (first/last: 100 chars)
- **Phone numbers**: Normalized, max 50 chars
- **Messages**: Truncated to max 10 KB
- **Event names**: Alphanumeric + dots/hyphens/underscores, max 100 chars
- **Analytics properties**: Max 50 keys, max 100 chars per key, max 1000 chars per value

All string inputs are trimmed and truncated before use to prevent injection attacks and excessive storage.

**Implementation**: `functions/src/middleware/input-validator.ts`

### 4. Abuse Protection

#### Honeypot (submit-widget-form)

Hidden field `_hp` in form submissions. If filled, the submission is treated as spam and silently rejected (returns success to avoid revealing honeypot).

#### Duplicate Suppression (submit-widget-form)

Prevents identical submissions from the same IP + org within 60 seconds. Uses payload hash for comparison.

#### Public Write Token (store-analytics-event)

Optional per-org token stored in analytics config. If configured, requests must include token in:
- Header: `x-analytics-token`
- Query parameter: `token`
- Body field: `token`

Token can be rotated/disabled per org to prevent abuse.

#### Event Sampling (store-analytics-event)

When org-level rate limits are exceeded, events are sampled (10% kept) instead of hard-failing. This protects Firestore while allowing some events through.

**Implementation**: `functions/src/middleware/abuse-protection.ts`

### 5. Caching (Config Endpoints)

In-memory cache for `get-widget-config` and `get-analytics-config`:

- 5-minute TTL per config
- Reduces Firestore reads for frequently requested configs
- HTTP cache headers set (`Cache-Control: public, max-age=300`)
- Cache hit/miss indicated via `X-Cache` header

**Implementation**: `functions/src/middleware/config-cache.ts`

### 6. IP Address Extraction

Robust IP extraction from request headers:
1. `x-forwarded-for` (first IP in list)
2. `x-real-ip`
3. `cf-connecting-ip` (Cloudflare)
4. `x-client-ip`
5. `socket.remoteAddress` (fallback)

IPs are hashed for privacy-safe logging and rate limiting.

**Implementation**: `functions/src/middleware/ip-extractor.ts`

## Architecture

### Middleware Structure

```
functions/src/middleware/
├── index.ts                    # Main exports
├── rate-limit-config.ts        # Central rate limit configuration
├── rate-limiter.ts             # Firestore-backed rate limiter
├── request-size-guard.ts      # Request size validation
├── input-validator.ts          # Input validation & normalization
├── ip-extractor.ts             # IP address extraction
├── config-cache.ts             # In-memory config caching
└── abuse-protection.ts         # Honeypot, duplicate detection, sampling
```

### Firestore Collections

- **rateLimits**: Rate limit tracking
  - Document ID: `{functionName}:{type}:{identifier}`
  - Fields: `count`, `windowStart`, `expiresAt`
  - TTL: 2x window duration

- **duplicateSubmissions**: Duplicate form submission tracking
  - Document ID: `{orgId}:{ipHash}:{payloadHash}`
  - Fields: `timestamp`, `orgId`, `ipHash`, `payloadHash`, `expiresAt`
  - TTL: 2x window duration (default 120 seconds)

## Configuration

### Rate Limits

Edit `functions/src/middleware/rate-limit-config.ts` to adjust limits:

```typescript
export const RATE_LIMIT_CONFIG: Record<string, FunctionRateLimitConfig> = {
  "submit-widget-form": {
    perIp: { maxRequests: 30, windowSeconds: 300 },
    perOrg: { maxRequests: 500, windowSeconds: 3600 },
  },
  // ...
};
```

### Request Size Limits

Edit `functions/src/middleware/rate-limit-config.ts`:

```typescript
export const REQUEST_SIZE_LIMITS: Record<string, number> = {
  "submit-widget-form": 50 * 1024, // 50 KB
  // ...
};
```

### Analytics Public Write Token

Set per-org via analytics config repository:

```typescript
await analyticsConfigRepository.update(orgId, {
  publicWriteToken: "your-token-here",
});
```

## Error Responses

### Rate Limit Exceeded (429)
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 300
}
```

### Request Too Large (400)
```json
{
  "error": "Request body too large. Maximum size: 51200 bytes"
}
```

### Invalid Input (400)
```json
{
  "error": "organizationId is required and must be a valid identifier"
}
```

### Invalid Token (403) - store-analytics-event
```json
{
  "error": "Invalid or missing write token"
}
```

## Monitoring & Logging

All security events are logged:

- **Rate limit exceeded**: Warning log with function name, limit type, IP hash, org ID
- **Rate limit approaching**: Info log when remaining < 10
- **Honeypot triggered**: Warning log with org ID and widget type
- **Duplicate submission**: Info log with org ID and payload hash
- **Event sampling**: Debug log when events are dropped due to rate limits
- **Invalid token**: Warning log with org ID and IP hash

## Backward Compatibility

- **store-analytics-event**: Public write token is optional. If not configured, requests work without token (backward compatible).
- All other functions maintain existing API contracts.
- Response shapes unchanged for valid requests.

## Testing

To test the hardening:

1. **Rate limiting**: Send rapid requests from same IP
2. **Size limits**: Send request with body exceeding limit
3. **Honeypot**: Submit form with `_hp` field filled
4. **Duplicate**: Submit same form twice within 60 seconds
5. **Token validation**: Send analytics event without/invalid token (if token configured)

## Future Enhancements

Potential improvements:

1. **reCAPTCHA integration**: Optional reCAPTCHA for form submissions
2. **IP reputation**: Block known bad IPs
3. **Adaptive rate limiting**: Adjust limits based on org subscription tier
4. **Distributed rate limiting**: Use Redis for multi-instance deployments
5. **Metrics dashboard**: Track rate limit hits, abuse patterns

## Files Changed

### New Files
- `functions/src/middleware/rate-limit-config.ts`
- `functions/src/middleware/rate-limiter.ts`
- `functions/src/middleware/request-size-guard.ts`
- `functions/src/middleware/input-validator.ts`
- `functions/src/middleware/ip-extractor.ts`
- `functions/src/middleware/config-cache.ts`
- `functions/src/middleware/abuse-protection.ts`
- `functions/src/middleware/index.ts`

### Modified Files
- `functions/src/functions/submit-widget-form.ts`
- `functions/src/functions/store-analytics-event.ts`
- `functions/src/functions/get-widget-config.ts`
- `functions/src/functions/get-analytics-config.ts`
- `functions/src/core/entities/analytics-config.ts` (added `publicWriteToken` field)

## Deployment Notes

1. **Firestore Indexes**: No new indexes required (rate limits use document IDs)
2. **TTL Policy**: Set up Firestore TTL policy for `rateLimits` and `duplicateSubmissions` collections (optional, documents have `expiresAt` field)
3. **Environment Variables**: No new environment variables required
4. **Breaking Changes**: None - all changes are backward compatible

