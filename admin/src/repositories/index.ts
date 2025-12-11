import { DatabaseService } from "@/core";
import { RepositoryHost } from "@/core/ports/repositories";
import { getTemplateRepository } from "./template-repository";
import { getInvoiceRepository } from "./invoice-repository";
import { getProposalRepository } from "./proposal-repository";
import { getOrganizationRepository } from "./organization-repository";
import { getUserRepository } from "./user-repository";
import { getInviteRepository } from "./invite-repository";
import { getWorkflowRepository } from "./workflow-repository";
import { getTaskRepository } from "./task-repository";
import { getNotificationRepository } from "./notification-repository";
import { getContactRepository } from "./contact-repository";
import { getLeadRepository } from "./lead-repository";
import { getProductRepository } from "./product-repository";
import { getAnalyticsConfigRepository } from "./analytics-config-repository";
import { getExtractionJobRepository } from "./extraction-job-repository";

/**
 * Repository host - follows the same pattern as app/src/repositories/index.ts
 * Repositories are factory functions that take databaseService as parameter
 */
export const repositoryHost: RepositoryHost = {
  getTemplatesReposity: (databaseService: DatabaseService) =>
    getTemplateRepository(databaseService),
  getInvoicesReposity: (databaseService: DatabaseService) =>
    getInvoiceRepository(databaseService),
  getInvoicesRepository: (databaseService: DatabaseService) =>
    getInvoiceRepository(databaseService),
  getProposalsRepository: (databaseService: DatabaseService) =>
    getProposalRepository(databaseService),
  getOrganizationsRepository: (databaseService: DatabaseService) =>
    getOrganizationRepository(databaseService),
  getUsersRepository: (databaseService: DatabaseService) =>
    getUserRepository(databaseService),
  getInvitesRepository: (databaseService: DatabaseService) =>
    getInviteRepository(databaseService),
  getWorkflowsRepository: (databaseService: DatabaseService) =>
    getWorkflowRepository(databaseService),
  getTasksRepository: (databaseService: DatabaseService) =>
    getTaskRepository(databaseService),
  getNotificationsRepository: (databaseService: DatabaseService) =>
    getNotificationRepository(databaseService),
  getContactsRepository: (databaseService: DatabaseService) =>
    getContactRepository(databaseService),
  getLeadsRepository: (databaseService: DatabaseService) =>
    getLeadRepository(databaseService),
  getProductsRepository: (databaseService: DatabaseService) =>
    getProductRepository(databaseService),
  getAnalyticsConfigRepository: (databaseService: DatabaseService) =>
    getAnalyticsConfigRepository(databaseService),
  getExtractionJobRepository: (databaseService: DatabaseService) =>
    getExtractionJobRepository(databaseService),
};