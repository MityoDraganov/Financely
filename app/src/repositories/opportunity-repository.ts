import { DatabaseService, Opportunity, OpportunityData } from "@/core";
import { OpportunityRepository } from "@/core/ports/repositories/opportunity-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getOpportunityRepository(
  databaseService: DatabaseService,
): OpportunityRepository {
  return getGenericRepository<Opportunity, OpportunityData>(
    () => DatabaseCollection.OPPORTUNITIES,
    databaseService,
  );
}
