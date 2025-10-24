import { DatabaseService } from "../core";
import { RepositoryHost } from "../core/ports/repositories";
import { getInvoiceRepository } from "./invoice-repository";
import { getOrganizationRepository } from "./organization-repository";
import { getUserRepository } from "./user-repository";
import { getWorkflowRepository } from "./workflow-repository";

export const repositoryHost: RepositoryHost = {
  getInvoiceRepository: (databaseService: DatabaseService) =>
    getInvoiceRepository(databaseService),
  getOrganizationsRepository: (databaseService: DatabaseService) =>
    getOrganizationRepository(databaseService),
  getUsersRepository: (databaseService: DatabaseService) =>
    getUserRepository(databaseService),
  getWorkflowsRepository: (databaseService: DatabaseService) =>
    getWorkflowRepository(databaseService),
};
