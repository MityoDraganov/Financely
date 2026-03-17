/**
 * Central configuration for rate limiting across public Cloud Functions.
 * 
 * Each function can have:
 * - Per-IP limits: Applied to requests from the same IP address
 * - Per-org limits: Applied to requests for the same organization ID
 * 
 * Limits are defined as:
 * - maxRequests: Maximum number of requests allowed
 * - windowSeconds: Time window in seconds for the limit
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface FunctionRateLimitConfig {
  /** Rate limit for requests from the same IP address */
  perIp: RateLimitConfig;
  /** Rate limit for requests for the same organization (if applicable) */
  perOrg?: RateLimitConfig;
}

/**
 * Rate limit configuration for each public function.
 * 
 * Tuning guidelines:
 * - Per-IP limits should be stricter to prevent abuse from single sources
 * - Per-org limits should be higher but still bounded to prevent quota exhaustion
 * - Window durations should balance between preventing abuse and allowing legitimate bursts
 */
export const RATE_LIMIT_CONFIG: Record<string, FunctionRateLimitConfig> = {
  "submit-widget-form": {
    perIp: {
      maxRequests: 30, // 30 requests
      windowSeconds: 300, // per 5 minutes
    },
    perOrg: {
      maxRequests: 500, // 500 requests
      windowSeconds: 3600, // per hour
    },
  },
  "store-analytics-event": {
    perIp: {
      maxRequests: 100, // 100 requests
      windowSeconds: 60, // per minute (stricter short window)
    },
    perOrg: {
      maxRequests: 10000, // 10k requests
      windowSeconds: 3600, // per hour (analytics can be high volume)
    },
  },
  "get-widget-config": {
    perIp: {
      maxRequests: 60, // 60 requests
      windowSeconds: 60, // per minute
    },
    perOrg: {
      maxRequests: 1000, // 1000 requests
      windowSeconds: 3600, // per hour
    },
  },
  "get-public-product-page": {
    perIp: {
      maxRequests: 120, // 120 requests
      windowSeconds: 60, // per minute
    },
  },
  "get-analytics-config": {
    perIp: {
      maxRequests: 60, // 60 requests
      windowSeconds: 60, // per minute
    },
    perOrg: {
      maxRequests: 1000, // 1000 requests
      windowSeconds: 3600, // per hour
    },
  },
};

/**
 * Request size limits in bytes for each function.
 * 
 * These limits are enforced before any processing to prevent
 * memory exhaustion and DoS attacks via large payloads.
 */
export const REQUEST_SIZE_LIMITS: Record<string, number> = {
  "submit-widget-form": 50 * 1024, // 50 KB - enough for form data
  "store-analytics-event": 10 * 1024, // 10 KB - analytics events should be compact
  "get-widget-config": 1024, // 1 KB - query params only
  "get-public-product-page": 2048, // 2 KB - query params only
  "get-analytics-config": 1024, // 1 KB - query params only
};

/**
 * Get rate limit configuration for a function.
 */
export function getRateLimitConfig(functionName: string): FunctionRateLimitConfig | null {
  return RATE_LIMIT_CONFIG[functionName] || null;
}

/**
 * Get request size limit for a function.
 */
export function getRequestSizeLimit(functionName: string): number {
  return REQUEST_SIZE_LIMITS[functionName] || 10 * 1024; // Default 10 KB
}
