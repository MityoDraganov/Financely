import { DatabaseService, Proposal, ProposalData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export const getProposalRepository = (databaseService: DatabaseService) => {
  return getGenericRepository<Proposal, ProposalData>(
    () => DatabaseCollection.PROPOSALS,
    databaseService,
  );
};
