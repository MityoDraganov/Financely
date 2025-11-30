import { logger } from "firebase-functions";

/**
 * Simple in-memory cache for config endpoints.
 * 
 * This cache reduces Firestore reads for frequently requested configs.
 * Cache entries expire after a configured TTL.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class ConfigCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlSeconds = 300; // 5 minutes default

  /**
   * Get a value from cache.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in cache.
   */
  set<T>(key: string, data: T, ttlSeconds = this.defaultTtlSeconds): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Clear a specific cache entry.
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries (should be called periodically).
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
      logger.debug("Config cache cleanup", { cleaned, remaining: this.cache.size });
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
let cacheInstance: ConfigCache | null = null;

/**
 * Get the singleton config cache instance.
 */
export function getConfigCache(): ConfigCache {
  if (!cacheInstance) {
    cacheInstance = new ConfigCache();
    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      cacheInstance?.cleanup();
    }, 5 * 60 * 1000);
  }
  return cacheInstance;
}

