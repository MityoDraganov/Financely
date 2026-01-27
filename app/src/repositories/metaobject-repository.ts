import { MetaobjectDefinitionRepository, MetaobjectRepository, DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getMetaobjectDefinitionRepository(
  databaseService: DatabaseService,
): MetaobjectDefinitionRepository {
  return getGenericRepository<import("@/core").MetaobjectDefinition, import("@/core").MetaobjectDefinitionData>(
    () => DatabaseCollection.METAOBJECT_DEFINITIONS,
    databaseService,
  );
}

export function getMetaobjectRepository(
  databaseService: DatabaseService,
): MetaobjectRepository {
  return getGenericRepository<import("@/core").Metaobject, import("@/core").MetaobjectData>(
    () => DatabaseCollection.METAOBJECTS,
    databaseService,
  );
}
