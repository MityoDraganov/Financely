import {
  ContactMetafield,
  ContactMetafieldData,
  ContactMetafieldDefinition,
  ContactMetafieldDefinitionData,
} from "../../entities/contact-metafield";
import { EntityMetafieldDefinitionRepository, EntityMetafieldRepository } from "./entity-metafield-repository";

export type ContactMetafieldDefinitionRepository =
  EntityMetafieldDefinitionRepository<ContactMetafieldDefinition, ContactMetafieldDefinitionData>;

export interface ContactMetafieldRepository
  extends EntityMetafieldRepository<ContactMetafield, ContactMetafieldData> {
  getByContactId(contactId: string): Promise<ContactMetafield[]>;
}
