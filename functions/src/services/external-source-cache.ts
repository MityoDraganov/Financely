import { getDatabaseService } from "./database-service";
import { DatabaseCollection } from "../repositories/config";
import { DataContextValue } from "../core/entities/data-context";
import { logger } from "firebase-functions";

interface CacheEntry {
  data: Record<string, DataContextValue>;
  timestamp: string;
  ttl: number;
}

export class ExternalSourceCacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();

  async get(sourceId: string): Promise<Record<string, DataContextValue> | null> {
    const memoryEntry = this.memoryCache.get(sourceId);
    if (memoryEntry) {
      const age = Date.now() - new Date(memoryEntry.timestamp).getTime();
      if (age < memoryEntry.ttl * 1000) {
        return memoryEntry.data;
      }
      this.memoryCache.delete(sourceId);
    }

    const databaseService = getDatabaseService();
    const cacheKey = `external:${sourceId}`;

    try {
      const cached = await databaseService.get<CacheEntry>(
        DatabaseCollection.EXTERNAL_SOURCE_CACHE,
        cacheKey
      );

      if (cached && cached.timestamp) {
        const age = Date.now() - new Date(cached.timestamp).getTime();
        const ttl = cached.ttl || 300;
        if (age < ttl * 1000) {
          this.memoryCache.set(sourceId, cached);
          return cached.data;
        }
      }
    } catch (error) {
      logger.warn("Failed to read from cache", {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  async set(
    sourceId: string,
    data: Record<string, DataContextValue>,
    ttl: number = 300
  ): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: new Date().toISOString(),
      ttl,
    };

    this.memoryCache.set(sourceId, entry);

    const databaseService = getDatabaseService();
    const cacheKey = `external:${sourceId}`;

    try {
      await databaseService.set(
        DatabaseCollection.EXTERNAL_SOURCE_CACHE,
        cacheKey,
        entry
      );
    } catch (error) {
      logger.warn("Failed to write to cache", {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async invalidate(sourceId: string): Promise<void> {
    this.memoryCache.delete(sourceId);

    const databaseService = getDatabaseService();
    const cacheKey = `external:${sourceId}`;

    try {
      await databaseService.delete(DatabaseCollection.EXTERNAL_SOURCE_CACHE, cacheKey);
    } catch (error) {
      logger.warn("Failed to invalidate cache", {
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

export const externalSourceCacheService = new ExternalSourceCacheService();

