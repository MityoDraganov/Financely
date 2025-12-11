import { logger } from "firebase-functions";
import { BrandContext } from "../core/entities/brand-context";

/**
 * In-memory cache for Brand Context.
 * 
 * This cache significantly reduces Firestore reads by caching assembled
 * brand context data (organization + products) for each organization.
 * 
 * Cache entries are keyed by organizationId and automatically expire
 * after a configured TTL. The cache can be invalidated when organization
 * or product data changes.
 */

interface CacheEntry {
  data: BrandContext;
  expiresAt: number;
  version: number;
}

class BrandContextCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlSeconds = 600; // 10 minutes default (brand data changes infrequently)
  private versionCounter = new Map<string, number>(); // Track versions per organization

  /**
   * Get brand context from cache.
   * Returns null if not found or expired.
   */
  get(organizationId: string): BrandContext | null {
    const entry = this.cache.get(organizationId);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(organizationId);
      return null;
    }

    return entry.data;
  }

  /**
   * Set brand context in cache.
   * @param organizationId - The organization ID
   * @param data - The brand context data
   * @param ttlSeconds - Optional TTL override (default: 10 minutes)
   */
  set(organizationId: string, data: BrandContext, ttlSeconds?: number): void {
    const version = (this.versionCounter.get(organizationId) || 0) + 1;
    this.versionCounter.set(organizationId, version);

    this.cache.set(organizationId, {
      data: {
        ...data,
        cachedAt: new Date().toISOString(),
        version,
      },
      expiresAt: Date.now() + (ttlSeconds || this.defaultTtlSeconds) * 1000,
      version,
    });
  }

  /**
   * Invalidate cache for a specific organization.
   * This should be called when organization or product data changes.
   */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
    // Increment version to force refresh on next get
    const currentVersion = this.versionCounter.get(organizationId) || 0;
    this.versionCounter.set(organizationId, currentVersion + 1);
    logger.debug("Brand context cache invalidated", { organizationId });
  }

  /**
   * Invalidate cache for all organizations.
   * Use sparingly - typically only for system-wide changes.
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.versionCounter.clear();
    logger.info("Brand context cache cleared", { clearedEntries: count });
  }

  /**
   * Check if cache entry exists and is valid.
   */
  has(organizationId: string): boolean {
    const entry = this.cache.get(organizationId);
    if (!entry) {
      return false;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(organizationId);
      return false;
    }
    return true;
  }

  /**
   * Clean up expired entries.
   * Should be called periodically to prevent memory leaks.
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Brand context cache cleanup", {
        cleaned,
        remaining: this.cache.size,
      });
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    keys: string[];
    totalVersions: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalVersions: Array.from(this.versionCounter.values()).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Get the current version for an organization.
   */
  getVersion(organizationId: string): number {
    return this.versionCounter.get(organizationId) || 0;
  }
}

// Singleton instance
let cacheInstance: BrandContextCache | null = null;

/**
 * Get the singleton brand context cache instance.
 */
export function getBrandContextCache(): BrandContextCache {
  if (!cacheInstance) {
    cacheInstance = new BrandContextCache();
    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      cacheInstance?.cleanup();
    }, 5 * 60 * 1000);
  }
  return cacheInstance;
}

