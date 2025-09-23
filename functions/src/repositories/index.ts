import { DatabaseService } from "../core";
import { RepositoryHost } from "../core/ports/repositories";
import { getProposalRepository } from "./proposal-repository";

export const repositoryHost: RepositoryHost = {
  getProposalRepository: (databaseService: DatabaseService) =>
    getProposalRepository(databaseService),
};
