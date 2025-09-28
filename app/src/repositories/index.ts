import { DatabaseService } from "@/core";
import { RepositoryHost } from "@/core/ports/repositories";


import { getTemplateRepository } from "./template-repository";


export const repositoryHost: RepositoryHost = {
    getTemplatesReposity: (databaseService: DatabaseService) =>
      getTemplateRepository(databaseService)
  }