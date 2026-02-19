import z from "zod";
import { baseEntitySchema } from "./base";
import {
  createEntityMetafieldDataSchema,
  CreateMetafieldDefinitionInput,
  metafieldDefinitionDataSchema,
  UpdateMetafieldDefinitionInput,
} from "./metafield";

export const contactMetafieldDefinitionDataSchema = metafieldDefinitionDataSchema;
export type ContactMetafieldDefinitionData = z.infer<typeof contactMetafieldDefinitionDataSchema>;
export const contactMetafieldDefinitionSchema = baseEntitySchema.merge(contactMetafieldDefinitionDataSchema);
export type ContactMetafieldDefinition = z.infer<typeof contactMetafieldDefinitionSchema>;

export const contactMetafieldDataSchema = createEntityMetafieldDataSchema("contactId", "Contact");
export type ContactMetafieldData = z.infer<typeof contactMetafieldDataSchema>;
export const contactMetafieldSchema = baseEntitySchema.merge(contactMetafieldDataSchema);
export type ContactMetafield = z.infer<typeof contactMetafieldSchema>;

export type CreateContactMetafieldDefinitionInput = CreateMetafieldDefinitionInput;
export type UpdateContactMetafieldDefinitionInput = UpdateMetafieldDefinitionInput;

export type CreateContactMetafieldInput = Omit<ContactMetafieldData, "organizationId"> & {
  organizationId: string;
};

export type UpdateContactMetafieldInput = Partial<Omit<ContactMetafieldData, "organizationId" | "contactId" | "definitionId">>;
