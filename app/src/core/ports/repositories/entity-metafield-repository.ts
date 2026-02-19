import { GenericRepository } from "./generic-repository";

export type EntityMetafieldDefinitionRepository<TDefinition, TDefinitionData> =
  GenericRepository<TDefinition, TDefinitionData>;

export interface EntityMetafieldRepository<TMetafield, TMetafieldData>
  extends GenericRepository<TMetafield, TMetafieldData> {
  getByEntityId(entityId: string): Promise<TMetafield[]>;
  getByDefinitionId(definitionId: string): Promise<TMetafield[]>;
}
