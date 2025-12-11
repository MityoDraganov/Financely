import { DatabaseService } from "@/core";
import { databaseService } from "./database/database-service";

export type ServiceHost = {
  getDatabaseService: () => DatabaseService;
};

/**
 * Service host - follows the same pattern as app/src/services/index.ts
 * Provides centralized access to all services
 */
export const serviceHost: ServiceHost = {
  getDatabaseService() {
    return databaseService;
  },
};

