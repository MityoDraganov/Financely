import { DatabaseService } from "@/core";
import { RepositoryHost } from "@/core/ports/repositories";


import { getTemplateRepository } from "./template-repository";
import { getInvoiceRepository } from "./invoice-repository";
import { getOrganizationRepository } from "./organization-repository";
import { getUserRepository } from "./user-repository";
import { getInviteRepository } from "./invite-repository";


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
  }