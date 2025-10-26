import { DatabaseService } from "@/core";
import { RepositoryHost } from "@/core/ports/repositories";


import { getTemplateRepository } from "./template-repository";
import { getInvoiceRepository } from "./invoice-repository";
import { getOrganizationRepository } from "./organization-repository";
import { getUserRepository } from "./user-repository";
import { getInviteRepository } from "./invite-repository";
import { getWorkflowRepository } from "./workflow-repository";
import { getTaskRepository } from "./task-repository";
import { getNotificationRepository } from "./notification-repository";

export const repositoryHost: RepositoryHost = {
    getTemplatesReposity: (databaseService: DatabaseService) =>
      getTemplateRepository(databaseService),
    getInvoicesReposity: (databaseService: DatabaseService) =>
      getInvoiceRepository(databaseService),
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
  }