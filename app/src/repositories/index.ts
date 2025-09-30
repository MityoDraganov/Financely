import { DatabaseService } from "@/core";
import { RepositoryHost } from "@/core/ports/repositories";


import { getTemplateRepository } from "./template-repository";
import { getInvoiceRepository } from "./invoice-repository";


export const repositoryHost: RepositoryHost = {
    getTemplatesReposity: (databaseService: DatabaseService) =>
      getTemplateRepository(databaseService),
    getInvoicesReposity: (databaseService: DatabaseService) =>
      getInvoiceRepository(databaseService)
  }