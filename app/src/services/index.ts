import { FunctionsService, AuthenticationService } from "@/core";
import { databaseService } from "./database/database-service";
import { functionsService } from "./functions/functions-service";
import { authenticationService } from "./authentication/authentication-service";

export type ServiceHost = {
  getDatabaseService: () => typeof databaseService;
  getFunctionsService: () => FunctionsService;
  getAuthenticationService: () => AuthenticationService;
};

export const serviceHost: ServiceHost = {
  getDatabaseService() {
    return databaseService;
  },
  getFunctionsService() {
    return functionsService;
  },
  getAuthenticationService() {
    return authenticationService;
  },
};

