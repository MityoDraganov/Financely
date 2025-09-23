import { DatabaseService } from "../services/database-service";
import { ProposalRepository } from "./proposal-repository";

export interface RepositoryHost {
    getProposalRepository: (
      databaseService: DatabaseService,
    ) => ProposalRepository;
}
