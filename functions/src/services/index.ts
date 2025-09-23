import { loggerService } from "./logger-service";
import { databaseService } from "./database-service";

export const serviceHost = {
  getLoggerService() {
    return loggerService;
  },
  getDatabaseService() {
    return databaseService;
  },
};

