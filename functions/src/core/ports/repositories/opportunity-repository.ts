import { Opportunity, OpportunityData } from "../../entities/opportunity";
import { GenericRepository } from "./generic-repository";

export type OpportunityRepository = GenericRepository<Opportunity, OpportunityData>;
