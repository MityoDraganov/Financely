import { DatabaseService } from "../core";
import { Opportunity, OpportunityData } from "../core/entities/opportunity";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getOpportunityRepository(databaseService: DatabaseService) {
  return getGenericRepository<Opportunity, OpportunityData>(
    () => DatabaseCollection.OPPORTUNITIES,
    databaseService,
  );
}
