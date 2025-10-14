import { FunctionsService, AuthenticationService } from "@/core";
import { databaseService } from "./database/database-service";
import { functionsService } from "./functions/functions-service";
import { authenticationService } from "./authentication/authentication-service";
import { inviteService } from "./invite/invite-service";

export type ServiceHost = {
  getDatabaseService: () => typeof databaseService;
  getFunctionsService: () => FunctionsService;
  getAuthenticationService: () => AuthenticationService;
  getInviteService: () => typeof inviteService;
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
  getInviteService() {
    return inviteService;
  },
};

