import { FunctionsService } from "@/core";
import { databaseService } from "./database/database-service";
import { functionsService } from "./functions/functions-service";

export type ServiceHost = {
  getDatabaseService: () => typeof databaseService;
  getFunctionsService: () => FunctionsService;
};

export const serviceHost: ServiceHost = {
  getDatabaseService() {
    return databaseService;
  },
  getFunctionsService() {
    return functionsService;
  },
};

