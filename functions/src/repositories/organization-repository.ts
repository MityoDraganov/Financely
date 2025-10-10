import { DatabaseService } from "../core";
import { Organization, OrganizationData } from "../core/entities/organization";
import { OrganizationRepository } from "../core/ports/repositories/organization-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for an `OrganizationRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {OrganizationRepository} Repository with CRUD operations for organizations.
 */
export function getOrganizationRepository(
  databaseService: DatabaseService,
): OrganizationRepository {
  return getGenericRepository<Organization, OrganizationData>(
    () => DatabaseCollection.ORGANIZATIONS,
    databaseService,
  );
}

