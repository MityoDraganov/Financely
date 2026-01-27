import {
  MetaobjectDefinition,
  Metaobject,
  CreateMetaobjectDefinitionInput,
  UpdateMetaobjectDefinitionInput,
  CreateMetaobjectInput,
  UpdateMetaobjectInput,
} from "@/core";
import { getMetaobjectDefinitionRepository, getMetaobjectRepository } from "@/repositories/metaobject-repository";
import { databaseService } from "./database/database-service";

const metaobjectDefinitionRepository = getMetaobjectDefinitionRepository(databaseService);
const metaobjectRepository = getMetaobjectRepository(databaseService);

export type MetaobjectService = {
  // Metaobject Definition operations
  createMetaobjectDefinition: (data: CreateMetaobjectDefinitionInput) => Promise<string>;
  getMetaobjectDefinition: (id: string) => Promise<MetaobjectDefinition | null>;
  listMetaobjectDefinitions: (orgId: string) => Promise<MetaobjectDefinition[]>;
  updateMetaobjectDefinition: (id: string, data: UpdateMetaobjectDefinitionInput) => Promise<void>;
  deleteMetaobjectDefinition: (id: string) => Promise<void>;

  // Metaobject operations
  createMetaobject: (data: CreateMetaobjectInput) => Promise<string>;
  getMetaobject: (id: string) => Promise<Metaobject | null>;
  listMetaobjects: (orgId: string, definitionId?: string) => Promise<Metaobject[]>;
  updateMetaobject: (id: string, data: UpdateMetaobjectInput) => Promise<void>;
  deleteMetaobject: (id: string) => Promise<void>;
};

export const metaobjectService: MetaobjectService = {
  async createMetaobjectDefinition(data) {
    const result = await metaobjectDefinitionRepository.create({
      data: {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    return result.id;
  },

  async getMetaobjectDefinition(id) {
    return metaobjectDefinitionRepository.get({ id });
  },

  async listMetaobjectDefinitions(orgId) {
    const result = await metaobjectDefinitionRepository.getAll({
      queryConstraints: [{ field: "organizationId", operator: "==", value: orgId }],
    });
    return result || [];
  },

  async updateMetaobjectDefinition(id, data) {
    await metaobjectDefinitionRepository.update({
      id,
      data: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  async deleteMetaobjectDefinition(id) {
    await metaobjectDefinitionRepository.delete({ id });
  },

  async createMetaobject(data) {
    const result = await metaobjectRepository.create({
      data: {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    return result.id;
  },

  async getMetaobject(id) {
    return metaobjectRepository.get({ id });
  },

  async listMetaobjects(orgId, definitionId) {
    const constraints = [{ field: "organizationId", operator: "==", value: orgId }];
    if (definitionId) {
      constraints.push({ field: "definitionId", operator: "==", value: definitionId });
    }
    const result = await metaobjectRepository.getAll({
      queryConstraints: constraints,
    });
    return result || [];
  },

  async updateMetaobject(id, data) {
    await metaobjectRepository.update({
      id,
      data: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  async deleteMetaobject(id) {
    await metaobjectRepository.delete({ id });
  },
};
