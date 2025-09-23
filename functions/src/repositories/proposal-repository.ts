import { DatabaseService, Proposal, ProposalData, ProposalRepository } from "../core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `ProposalRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ProposalRepository} Repository with CRUD operations for proposals.
 */
export function getProposalRepository(
  databaseService: DatabaseService,
): ProposalRepository {
  return getGenericRepository<Proposal, ProposalData>(
    () => DatabaseCollection.PROPOSALS,
    databaseService,
  );
}
