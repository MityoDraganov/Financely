import { DatabaseService } from "../core";
import { MetaobjectDefinition, MetaobjectDefinitionData, Metaobject, MetaobjectData } from "../core/entities/metaobject";
import { MetaobjectDefinitionRepository, MetaobjectRepository } from "../core/ports/repositories/metaobject-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getMetaobjectDefinitionRepository(
  databaseService: DatabaseService,
): MetaobjectDefinitionRepository {
  return getGenericRepository<MetaobjectDefinition, MetaobjectDefinitionData>(
    () => DatabaseCollection.METAOBJECT_DEFINITIONS,
    databaseService,
  );
}

export function getMetaobjectRepository(
  databaseService: DatabaseService,
): MetaobjectRepository {
  return getGenericRepository<Metaobject, MetaobjectData>(
    () => DatabaseCollection.METAOBJECTS,
    databaseService,
  );
}
