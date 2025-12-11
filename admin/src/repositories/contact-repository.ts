import { DatabaseService, Contact, ContactData } from "@/core";
import { ContactRepository } from "@/core/ports/repositories/contact-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `ContactRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ContactRepository} Repository with CRUD operations for contacts.
 */
export function getContactRepository(
  databaseService: DatabaseService,
): ContactRepository {
  return getGenericRepository<Contact, ContactData>(
    () => DatabaseCollection.CONTACTS,
    databaseService,
  );
}
