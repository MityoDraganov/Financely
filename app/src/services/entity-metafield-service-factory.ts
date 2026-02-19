import type { QueryConstraint } from "@/core";

type CrudRepository<TEntity, TData> = {
  create(args: { data: TData }): Promise<string>;
  get(args: { id: string }): Promise<TEntity | null>;
  getAll(args: { queryConstraints?: QueryConstraint[] }): Promise<TEntity[]>;
  update(args: { id: string; data: Partial<TData> }): Promise<void>;
  delete(args: { id: string }): Promise<void>;
};

type EntityMetafieldServiceFactoryParams<
  TDefinition,
  TDefinitionData extends { organizationId: string },
  TMetafield,
  TMetafieldData extends { organizationId: string; definitionId: string },
> = {
  definitionRepository: CrudRepository<TDefinition, TDefinitionData>;
  metafieldRepository: CrudRepository<TMetafield, TMetafieldData>;
  entityIdField: string;
};

export function createEntityMetafieldService<
  TDefinition,
  TDefinitionData extends { organizationId: string },
  TMetafield,
  TMetafieldData extends { organizationId: string; definitionId: string },
>({
  definitionRepository,
  metafieldRepository,
  entityIdField,
}: EntityMetafieldServiceFactoryParams<
  TDefinition,
  TDefinitionData,
  TMetafield,
  TMetafieldData
>) {
  return {
    async createMetafieldDefinition(data: TDefinitionData): Promise<string> {
      const result = await definitionRepository.create({ data });
      return result;
    },

    async getMetafieldDefinition(id: string): Promise<TDefinition | null> {
      return definitionRepository.get({ id });
    },

    async listMetafieldDefinitions(orgId: string): Promise<TDefinition[]> {
      const result = await definitionRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==" as const, value: orgId }],
      });
      return result || [];
    },

    async updateMetafieldDefinition(id: string, data: Partial<TDefinitionData>): Promise<void> {
      await definitionRepository.update({
        id,
        data,
      });
    },

    async deleteMetafieldDefinition(id: string): Promise<void> {
      await definitionRepository.delete({ id });
    },

    async createMetafield(data: TMetafieldData): Promise<string> {
      const result = await metafieldRepository.create({
        data,
      });
      return result;
    },

    async getMetafield(id: string): Promise<TMetafield | null> {
      return metafieldRepository.get({ id });
    },

    async listMetafields(
      orgId: string,
      entityId?: string,
      definitionId?: string,
    ): Promise<TMetafield[]> {
      const constraints: QueryConstraint[] = [
        { field: "organizationId", operator: "==" as const, value: orgId },
      ];
      if (entityId) {
        constraints.push({ field: entityIdField, operator: "==" as const, value: entityId });
      }
      if (definitionId) {
        constraints.push({ field: "definitionId", operator: "==" as const, value: definitionId });
      }
      const result = await metafieldRepository.getAll({
        queryConstraints: constraints,
      });
      return result || [];
    },

    async updateMetafield(id: string, data: Partial<TMetafieldData>): Promise<void> {
      await metafieldRepository.update({
        id,
        data,
      });
    },

    async deleteMetafield(id: string): Promise<void> {
      await metafieldRepository.delete({ id });
    },
  };
}
