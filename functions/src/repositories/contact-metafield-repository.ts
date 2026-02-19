import { ContactMetafieldDefinitionRepository, ContactMetafieldRepository, DatabaseService } from "../core";
import {
  ContactMetafieldDefinition,
  ContactMetafieldDefinitionData,
  ContactMetafield,
  ContactMetafieldData,
} from "../core/entities/contact-metafield";
import { DatabaseCollection } from "./config";
import { getEntityMetafieldDefinitionRepository, getEntityMetafieldRepository } from "./entity-metafield-repository";

export function getContactMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ContactMetafieldDefinitionRepository {
  return getEntityMetafieldDefinitionRepository<ContactMetafieldDefinition, ContactMetafieldDefinitionData>(
    () => DatabaseCollection.CONTACT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getContactMetafieldRepository(
  databaseService: DatabaseService,
): ContactMetafieldRepository {
  const genericRepo = getEntityMetafieldRepository<ContactMetafield, ContactMetafieldData>(
    () => DatabaseCollection.CONTACT_METAFIELDS,
    "contactId",
    databaseService,
  );

  return {
    ...genericRepo,
    async getByContactId(contactId: string) {
      return genericRepo.getByEntityId(contactId);
    },
  };
}
