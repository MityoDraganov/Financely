import { ExternalConnectorBase } from "./external-connector-base";
import { DataContextValue } from "../../../core/entities/data-context";
import { getDatabaseService } from "../../database-service";
import { DatabaseCollection } from "../../../repositories/config";

export class WebhookConnector extends ExternalConnectorBase {
  async fetch(): Promise<Record<string, DataContextValue>> {
    const databaseService = getDatabaseService();
    const cacheKey = `webhook:${this.config.id}`;

    const cached = await databaseService.get<{ data: Record<string, DataContextValue>; timestamp: string }>(
      DatabaseCollection.EXTERNAL_SOURCE_CACHE,
      cacheKey
    );

    if (cached && cached.timestamp) {
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const ttl = (this.config.cacheConfig?.ttl || 300) * 1000;

      if (cacheAge < ttl) {
        return cached.data;
      }
    }

    return this.normalizeData({}, this.config.schemaMapping);
  }

  async storeWebhookPayload(payload: unknown): Promise<void> {
    const normalized = this.normalizeData(payload, this.config.schemaMapping);
    const databaseService = getDatabaseService();
    const cacheKey = `webhook:${this.config.id}`;

    await databaseService.set(
      DatabaseCollection.EXTERNAL_SOURCE_CACHE,
      cacheKey,
      {
        data: normalized,
        timestamp: new Date().toISOString(),
      }
    );
  }
}

