import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getExternalSourceConfigRepository } from "../repositories/external-source-config-repository";
import { ExternalSourceConfig, ExternalSourceConfigData, externalSourceConfigDataSchema } from "../core/entities/external-source-config";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { externalConnectorRegistry } from "../services/data-sources/external/external-connector-registry";
import { externalSourceMonitor } from "../services/external-source-monitor";
import { v4 as uuidv4 } from "uuid";

interface CreateExternalSourcePayload {
  organizationId: string;
  data: ExternalSourceConfigData;
}

interface UpdateExternalSourcePayload {
  organizationId: string;
  sourceId: string;
  data: Partial<ExternalSourceConfigData>;
}

interface DeleteExternalSourcePayload {
  organizationId: string;
  sourceId: string;
}

interface ListExternalSourcesPayload {
  organizationId: string;
}

interface TestConnectionPayload {
  organizationId: string;
  sourceId?: string;
  data?: ExternalSourceConfigData;
}

interface RefreshSourcePayload {
  organizationId: string;
  sourceId: string;
}

export const createExternalSource = onCall<CreateExternalSourcePayload, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId, data } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      const validatedData = externalSourceConfigDataSchema.parse({
        ...data,
        orgId: organizationId,
      });

      const databaseService = getDatabaseService();
      const repository = getExternalSourceConfigRepository(databaseService);

      const sourceId = uuidv4();

      await repository.set({ id: sourceId, data: validatedData });

      logger.info("External source created", { sourceId, organizationId, type: validatedData.type });

      return { id: sourceId };
    } catch (error) {
      logger.error("Error creating external source", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to create external source"
      );
    }
  }
);

export const updateExternalSource = onCall<UpdateExternalSourcePayload, Promise<{ success: boolean }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId, sourceId, data } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      const databaseService = getDatabaseService();
      const repository = getExternalSourceConfigRepository(databaseService);

      const existing = await repository.get({ id: sourceId });
      if (!existing) {
        throw new HttpsError("not-found", "External source not found");
      }

      if (existing.orgId !== organizationId) {
        throw new HttpsError("permission-denied", "External source does not belong to organization");
      }

      await repository.update({ id: sourceId, data });

      logger.info("External source updated", { sourceId, organizationId });

      return { success: true };
    } catch (error) {
      logger.error("Error updating external source", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to update external source"
      );
    }
  }
);

export const deleteExternalSource = onCall<DeleteExternalSourcePayload, Promise<{ success: boolean }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId, sourceId } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      const databaseService = getDatabaseService();
      const repository = getExternalSourceConfigRepository(databaseService);

      const existing = await repository.get({ id: sourceId });
      if (!existing) {
        throw new HttpsError("not-found", "External source not found");
      }

      if (existing.orgId !== organizationId) {
        throw new HttpsError("permission-denied", "External source does not belong to organization");
      }

      await repository.delete({ id: sourceId });

      logger.info("External source deleted", { sourceId, organizationId });

      return { success: true };
    } catch (error) {
      logger.error("Error deleting external source", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to delete external source"
      );
    }
  }
);

export const listExternalSources = onCall<ListExternalSourcesPayload, Promise<{ sources: any[] }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      const databaseService = getDatabaseService();
      const repository = getExternalSourceConfigRepository(databaseService);

      const allSources = await repository.getAll({});
      const sources = allSources.filter((source) => source.orgId === organizationId);

      return { sources };
    } catch (error) {
      logger.error("Error listing external sources", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to list external sources"
      );
    }
  }
);

export const testExternalSourceConnection = onCall<TestConnectionPayload, Promise<{ success: boolean; error?: string; data?: unknown }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId, sourceId, data } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      const databaseService = getDatabaseService();
      const repository = getExternalSourceConfigRepository(databaseService);

      let config;
      if (sourceId) {
        config = await repository.get({ id: sourceId });
        if (!config) {
          throw new HttpsError("not-found", "External source not found");
        }
        if (config.orgId !== organizationId) {
          throw new HttpsError("permission-denied", "External source does not belong to organization");
        }
      } else if (data) {
        const validatedData = externalSourceConfigDataSchema.parse({
          ...data,
          orgId: organizationId,
        });
        config = {
          id: "test",
          ...validatedData,
        } as ExternalSourceConfig;
      } else {
        throw new HttpsError("invalid-argument", "Either sourceId or data must be provided");
      }

      const connector = externalConnectorRegistry.create(config);
      const fetched = await connector.fetch();

      return {
        success: true,
        data: fetched,
      };
    } catch (error) {
      logger.error("Error testing external source connection", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }
);

export const refreshExternalSource = onCall<RefreshSourcePayload, Promise<{ success: boolean; error?: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const { organizationId, sourceId } = request.data;

      await verifyAuthAndOrgMembership(request, organizationId);

      await externalSourceMonitor.refreshSource(sourceId);

      return { success: true };
    } catch (error) {
      logger.error("Error refreshing external source", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refresh source",
      };
    }
  }
);

