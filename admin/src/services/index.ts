import { DatabaseService } from "@/core";
import { databaseService } from "./database/database-service";
import { functionsService } from "./functions/functions-service";

export type ServiceHost = {
  getDatabaseService: () => DatabaseService;
  getFunctionsService: () => typeof functionsService;
};

/**
 * Service host - follows the same pattern as app/src/services/index.ts
 * Provides centralized access to all services
 */
export const serviceHost: ServiceHost = {
  getDatabaseService() {
    return databaseService;
  },
  getFunctionsService() {
    return functionsService;
  },
};

