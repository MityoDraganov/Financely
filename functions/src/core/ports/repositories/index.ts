import { DatabaseService } from "../services/database-service";
import { ProposalRepository } from "./proposal-repository";
import { InvoiceRepository } from "./invoice-repository";

export interface RepositoryHost {
    getProposalRepository: (
      databaseService: DatabaseService,
    ) => ProposalRepository;
    getInvoiceRepository: (
      databaseService: DatabaseService,
    ) => InvoiceRepository;
}
