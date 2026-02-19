import { DatabaseService } from "../core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

type CollectionResolver = () => DatabaseCollection;

export const getEntityMetafieldDefinitionRepository = <TDefinition, TDefinitionData>(
  collectionResolver: CollectionResolver,
  databaseService: DatabaseService,
) =>
  getGenericRepository<TDefinition, TDefinitionData>(collectionResolver, databaseService);

export const getEntityMetafieldRepository = <TMetafield, TMetafieldData>(
  collectionResolver: CollectionResolver,
  entityIdField: string,
  databaseService: DatabaseService,
) => {
  const genericRepo = getGenericRepository<TMetafield, TMetafieldData>(
    collectionResolver,
    databaseService,
  );

  return {
    ...genericRepo,
    async getByEntityId(entityId: string): Promise<TMetafield[]> {
      const result = await databaseService.getAllByFields<TMetafield>(
        collectionResolver(),
        [{ field: entityIdField, operator: "==", value: entityId }],
        {},
      );
      return result || [];
    },
    async getByDefinitionId(definitionId: string): Promise<TMetafield[]> {
      const result = await databaseService.getAllByFields<TMetafield>(
        collectionResolver(),
        [{ field: "definitionId", operator: "==", value: definitionId }],
        {},
      );
      return result || [];
    },
  };
};
