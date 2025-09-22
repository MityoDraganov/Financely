import { Proposal, ProposalData } from "../../entities/proposal";
import { GenericRepository } from "./generic-repository";

export type ProposalRepository = GenericRepository<Proposal, ProposalData>;
