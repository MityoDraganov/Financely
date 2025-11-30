import { firestore } from "firebase-admin";
import { logger } from "firebase-functions";
import { getRateLimitConfig } from "./rate-limit-config";
import { hashIpAddress } from "./ip-extractor";

/**
 * Rate limit result indicating whether the request should be allowed.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Time until the rate limit window resets (seconds) */
  resetIn: number;
  /** Which limit was exceeded (if any) */
  limitType?: "perIp" | "perOrg";
}

/**
 * Firestore-backed rate limiter for Cloud Functions.
 * 
 * Tracks request counts in time windows per key (e.g., route + IP, route + orgId).
 * Uses Firestore documents with TTL to automatically clean up expired entries.
 * 
 * Rate limit keys are stored in: rateLimits/{key}
 * Each document contains:
 * - count: number of requests in current window
 * - windowStart: timestamp when current window started
 * - expiresAt: timestamp when document should be deleted (for TTL)
 */
export class RateLimiter {
  private readonly collection = firestore().collection("rateLimits");

  /**
   * Check if a request should be allowed based on rate limits.
   * 
   * @param functionName - Name of the function being called
   * @param ipAddress - IP address of the requester (optional)
   * @param orgId - Organization ID (optional, for per-org limits)
   * @returns Rate limit result
   */
  async checkLimit(
    functionName: string,
    ipAddress?: string,
    orgId?: string
  ): Promise<RateLimitResult> {
    const config = getRateLimitConfig(functionName);
    if (!config) {
      // No rate limit configured, allow request
      return {
        allowed: true,
        remaining: Infinity,
        resetIn: 0,
      };
    }

    const now = Date.now();
    const results: RateLimitResult[] = [];

    // Check per-IP limit
    if (ipAddress) {
      const ipKey = `${functionName}:ip:${hashIpAddress(ipAddress)}`;
      const ipResult = await this.checkLimitForKey(
        ipKey,
        config.perIp,
        now
      );
      results.push({
        ...ipResult,
        limitType: "perIp",
      });
    }

    // Check per-org limit
    if (orgId && config.perOrg) {
      const orgKey = `${functionName}:org:${orgId}`;
      const orgResult = await this.checkLimitForKey(
        orgKey,
        config.perOrg,
        now
      );
      results.push({
        ...orgResult,
        limitType: "perOrg",
      });
    }

    // If any limit is exceeded, deny the request
    const exceeded = results.find((r) => !r.allowed);
    if (exceeded) {
      return exceeded;
    }

    // All limits passed, allow request
    const minRemaining = Math.min(...results.map((r) => r.remaining));
    const maxResetIn = Math.max(...results.map((r) => r.resetIn));

    return {
      allowed: true,
      remaining: minRemaining,
      resetIn: maxResetIn,
    };
  }

  /**
   * Check rate limit for a specific key.
   */
  private async checkLimitForKey(
    key: string,
    config: { maxRequests: number; windowSeconds: number },
    now: number
  ): Promise<RateLimitResult> {
    const docRef = this.collection.doc(key);
    const doc = await docRef.get();

    // Calculate window start: round down to the nearest window boundary
    const windowMs = config.windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = new Date(windowStart + windowMs * 2); // Keep for 2 windows

    if (!doc.exists) {
      // First request in window, create document
      await docRef.set({
        count: 1,
        windowStart,
        expiresAt,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: config.windowSeconds,
      };
    }

    const data = doc.data();
    if (!data) {
      // Document exists but no data (shouldn't happen)
      await docRef.set({
        count: 1,
        windowStart,
        expiresAt,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: config.windowSeconds,
      };
    }

    const storedWindowStart = (data.windowStart as number) || 0;
    const storedCount = (data.count as number) || 0;

    // Check if we're in a new window
    if (windowStart > storedWindowStart) {
      // New window, reset count
      await docRef.set({
        count: 1,
        windowStart,
        expiresAt,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: config.windowSeconds,
      };
    }

    // Same window, increment count
    const newCount = storedCount + 1;
    const windowEnd = windowStart + windowMs;
    const resetIn = Math.max(1, Math.ceil((windowEnd - now) / 1000));

    if (newCount > config.maxRequests) {
      // Limit exceeded - don't increment, just return failure
      return {
        allowed: false,
        remaining: 0,
        resetIn,
      };
    }

    // Update count
    await docRef.update({
      count: newCount,
      expiresAt,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetIn,
    };
  }

  /**
   * Log rate limit event for monitoring and debugging.
   */
  logRateLimitEvent(
    functionName: string,
    result: RateLimitResult,
    ipAddress?: string,
    orgId?: string
  ): void {
    if (!result.allowed) {
      logger.warn("Rate limit exceeded", {
        functionName,
        limitType: result.limitType,
        ipHash: ipAddress ? hashIpAddress(ipAddress) : undefined,
        orgId,
        resetIn: result.resetIn,
      });
    } else if (result.remaining < 10) {
      // Log when approaching limit
      logger.info("Rate limit approaching", {
        functionName,
        remaining: result.remaining,
        resetIn: result.resetIn,
        ipHash: ipAddress ? hashIpAddress(ipAddress) : undefined,
        orgId,
      });
    }
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance.
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

