import { CreateContactMetafieldDefinitionInput, contactMetafieldDefinitionDataSchema } from "../core/entities/contact-metafield";
import { getDatabaseService } from "../services/database-service";
import { getContactMetafieldDefinitionRepository } from "../repositories/contact-metafield-repository";
import { handleCreateEntityMetafieldDefinition } from "./handle-create-entity-metafield-definition";

export async function handleCreateContactMetafieldDefinition(
  payload: CreateContactMetafieldDefinitionInput,
): Promise<string> {
  return handleCreateEntityMetafieldDefinition({
    payload,
    entityLabel: "Contact",
    schema: contactMetafieldDefinitionDataSchema,
    getRepository: () => getContactMetafieldDefinitionRepository(getDatabaseService()),
  });
}
