import { ContactMetafieldDefinitionRepository, ContactMetafieldRepository, DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getEntityMetafieldDefinitionRepository, getEntityMetafieldRepository } from "./entity-metafield-repository";

export function getContactMetafieldDefinitionRepository(
  databaseService: DatabaseService,
): ContactMetafieldDefinitionRepository {
  return getEntityMetafieldDefinitionRepository<
    import("@/core").ContactMetafieldDefinition,
    import("@/core").ContactMetafieldDefinitionData
  >(
    () => DatabaseCollection.CONTACT_METAFIELD_DEFINITIONS,
    databaseService,
  );
}

export function getContactMetafieldRepository(
  databaseService: DatabaseService,
): ContactMetafieldRepository {
  const genericRepo = getEntityMetafieldRepository<
    import("@/core").ContactMetafield,
    import("@/core").ContactMetafieldData
  >(
    () => DatabaseCollection.CONTACT_METAFIELDS,
    "contactId",
    databaseService,
  );

  return {
    ...genericRepo,
    async getByContactId(contactId: string): Promise<import("@/core").ContactMetafield[]> {
      return genericRepo.getByEntityId(contactId);
    },
  };
}
