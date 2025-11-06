import { DatabaseService } from "../core";
import { Contact, ContactData } from "../core/entities/contact";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a ContactRepository backed by the provided DatabaseService.
 */
export function getContactRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<Contact, ContactData>(
    () => DatabaseCollection.CONTACTS,
    databaseService,
  );
}

