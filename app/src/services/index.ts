import { FunctionsService, AuthenticationService } from "@/core";
import { databaseService } from "./database/database-service";
import { functionsService } from "./functions/functions-service";
import { authenticationService } from "./authentication/authentication-service";
import { inviteService } from "./invite/invite-service";
import { workflowService } from "./workflow/workflow-service";
import { invoiceComplianceService } from "./invoice-compliance-service";

export { functionsService };

export type ServiceHost = {
  getDatabaseService: () => typeof databaseService;
  getFunctionsService: () => FunctionsService;
  getAuthenticationService: () => AuthenticationService;
  getInviteService: () => typeof inviteService;
  getWorkflowService: () => typeof workflowService;
  getInvoiceComplianceService: () => typeof invoiceComplianceService;
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
  getWorkflowService() {
    return workflowService;
  },
  getInvoiceComplianceService() {
    return invoiceComplianceService;
  },
};

