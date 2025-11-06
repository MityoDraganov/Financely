import { DatabaseService } from "../core";
import { Lead, LeadData } from "../core/entities/lead";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a LeadRepository backed by the provided DatabaseService.
 */
export function getLeadRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<Lead, LeadData>(
    () => DatabaseCollection.LEADS,
    databaseService,
  );
}

