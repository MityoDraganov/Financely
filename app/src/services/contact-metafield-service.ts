import {
  ContactMetafieldDefinition,
  ContactMetafieldDefinitionData,
  ContactMetafield,
  ContactMetafieldData,
  CreateContactMetafieldDefinitionInput,
  UpdateContactMetafieldDefinitionInput,
  CreateContactMetafieldInput,
  UpdateContactMetafieldInput,
} from "@/core";
import { getContactMetafieldDefinitionRepository, getContactMetafieldRepository } from "@/repositories/contact-metafield-repository";
import { databaseService } from "./database/database-service";
import { createEntityMetafieldService } from "./entity-metafield-service-factory";

const contactMetafieldDefinitionRepository = getContactMetafieldDefinitionRepository(databaseService);
const contactMetafieldRepository = getContactMetafieldRepository(databaseService);
const baseEntityMetafieldService = createEntityMetafieldService<
  ContactMetafieldDefinition,
  ContactMetafieldDefinitionData,
  ContactMetafield,
  ContactMetafieldData
>({
  definitionRepository: contactMetafieldDefinitionRepository,
  metafieldRepository: contactMetafieldRepository,
  entityIdField: "contactId",
});

export type ContactMetafieldService = {
  createContactMetafieldDefinition: (data: CreateContactMetafieldDefinitionInput) => Promise<string>;
  getContactMetafieldDefinition: (id: string) => Promise<ContactMetafieldDefinition | null>;
  listContactMetafieldDefinitions: (orgId: string) => Promise<ContactMetafieldDefinition[]>;
  updateContactMetafieldDefinition: (id: string, data: UpdateContactMetafieldDefinitionInput) => Promise<void>;
  deleteContactMetafieldDefinition: (id: string) => Promise<void>;

  createContactMetafield: (data: CreateContactMetafieldInput) => Promise<string>;
  getContactMetafield: (id: string) => Promise<ContactMetafield | null>;
  listContactMetafields: (orgId: string, contactId?: string, definitionId?: string) => Promise<ContactMetafield[]>;
  updateContactMetafield: (id: string, data: UpdateContactMetafieldInput) => Promise<void>;
  deleteContactMetafield: (id: string) => Promise<void>;
};

export const contactMetafieldService: ContactMetafieldService = {
  async createContactMetafieldDefinition(data) {
    return baseEntityMetafieldService.createMetafieldDefinition(data);
  },

  async getContactMetafieldDefinition(id) {
    return baseEntityMetafieldService.getMetafieldDefinition(id);
  },

  async listContactMetafieldDefinitions(orgId) {
    return baseEntityMetafieldService.listMetafieldDefinitions(orgId);
  },

  async updateContactMetafieldDefinition(id, data) {
    await baseEntityMetafieldService.updateMetafieldDefinition(id, data);
  },

  async deleteContactMetafieldDefinition(id) {
    await baseEntityMetafieldService.deleteMetafieldDefinition(id);
  },

  async createContactMetafield(data) {
    return baseEntityMetafieldService.createMetafield(data);
  },

  async getContactMetafield(id) {
    return baseEntityMetafieldService.getMetafield(id);
  },

  async listContactMetafields(orgId, contactId, definitionId) {
    return baseEntityMetafieldService.listMetafields(orgId, contactId, definitionId);
  },

  async updateContactMetafield(id, data) {
    await baseEntityMetafieldService.updateMetafield(id, data);
  },

  async deleteContactMetafield(id) {
    await baseEntityMetafieldService.deleteMetafield(id);
  },
};
