import { DatabaseService } from "../core";
import { RepositoryHost } from "../core/ports/repositories";
import { getProposalRepository } from "./proposal-repository";
import { getInvoiceRepository } from "./invoice-repository";

export const repositoryHost: RepositoryHost = {
  getProposalRepository: (databaseService: DatabaseService) =>
    getProposalRepository(databaseService),
  getInvoiceRepository: (databaseService: DatabaseService) =>
    getInvoiceRepository(databaseService),
};
