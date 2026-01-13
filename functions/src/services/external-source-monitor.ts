import { logger } from "firebase-functions";
import { getDatabaseService } from "./database-service";
import { getExternalSourceConfigRepository } from "../repositories/external-source-config-repository";
import { externalConnectorRegistry } from "./data-sources/external/external-connector-registry";
import { externalSourceCacheService } from "./external-source-cache";
import { ExternalSourceConfig } from "../core/entities/external-source-config";

export class ExternalSourceMonitor {
  async checkHealth(config: ExternalSourceConfig): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const connector = externalConnectorRegistry.create(config);
      await connector.fetch();

      const latency = Date.now() - startTime;

      if (config.status === "error") {
        await this.updateStatus(config.id, "active", null);
      }

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.recordError(config.id, errorMessage);
      await this.updateStatus(config.id, "error", errorMessage);

      return {
        healthy: false,
        latency,
        error: errorMessage,
      };
    }
  }

  async checkAllSources(organizationId: string): Promise<void> {
    const databaseService = getDatabaseService();
    const configRepository = getExternalSourceConfigRepository(databaseService);

    const allConfigs = await configRepository.getAll({});
    const configs = allConfigs.filter(
      (config) => config.orgId === organizationId && config.enabled === true
    );

    for (const config of configs) {
      try {
        await this.checkHealth(config);
      } catch (error) {
        logger.error(`Health check failed for external source ${config.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async refreshSource(sourceId: string): Promise<void> {
    const databaseService = getDatabaseService();
    const configRepository = getExternalSourceConfigRepository(databaseService);
    const config = await configRepository.get({ id: sourceId });

    if (!config) {
      throw new Error(`External source config not found: ${sourceId}`);
    }

    if (!config.enabled) {
      return;
    }

    try {
      const connector = externalConnectorRegistry.create(config);
      const data = await connector.fetch();

      const ttl = config.cacheConfig?.ttl || 300;
      await externalSourceCacheService.set(sourceId, data, ttl);

      await this.updateStatus(sourceId, "active", null);
      await this.updateLastSync(sourceId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.recordError(sourceId, errorMessage);
      await this.updateStatus(sourceId, "error", errorMessage);
      throw error;
    }
  }

  private async updateStatus(
    sourceId: string,
    status: "active" | "inactive" | "error",
    error: string | null
  ): Promise<void> {
    const databaseService = getDatabaseService();
    const configRepository = getExternalSourceConfigRepository(databaseService);

    await configRepository.update({
      id: sourceId,
      data: {
        status,
        ...(error && {
          errorLog: [{ timestamp: new Date().toISOString(), error }],
        }),
      },
    });
  }

  private async recordError(sourceId: string, error: string): Promise<void> {
    const databaseService = getDatabaseService();
    const configRepository = getExternalSourceConfigRepository(databaseService);
    const config = await configRepository.get({ id: sourceId });

    if (!config) {
      return;
    }

    const errorLog = config.errorLog || [];
    errorLog.push({
      timestamp: new Date().toISOString(),
      error,
    });

    if (errorLog.length > 10) {
      errorLog.shift();
    }

    await configRepository.update({
      id: sourceId,
      data: {
        errorLog,
      },
    });
  }

  private async updateLastSync(sourceId: string): Promise<void> {
    const databaseService = getDatabaseService();
    const configRepository = getExternalSourceConfigRepository(databaseService);

    await configRepository.update({
      id: sourceId,
      data: {
        lastSync: new Date().toISOString(),
      },
    });
  }
}

export const externalSourceMonitor = new ExternalSourceMonitor();

