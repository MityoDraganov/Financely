import { MetaobjectDefinition, MetaobjectDefinitionData, Metaobject, MetaobjectData } from "../../entities/metaobject";
import { GenericRepository } from "./generic-repository";

export type MetaobjectDefinitionRepository = GenericRepository<MetaobjectDefinition, MetaobjectDefinitionData>;
export type MetaobjectRepository = GenericRepository<Metaobject, MetaobjectData>;
