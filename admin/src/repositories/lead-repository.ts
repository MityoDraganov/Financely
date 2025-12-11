import { DatabaseService, Lead, LeadData } from "@/core";
import { LeadRepository } from "@/core/ports/repositories/lead-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `LeadRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {LeadRepository} Repository with CRUD operations for leads.
 */
export function getLeadRepository(
  databaseService: DatabaseService,
): LeadRepository {
  return getGenericRepository<Lead, LeadData>(
    () => DatabaseCollection.LEADS,
    databaseService,
  );
}

