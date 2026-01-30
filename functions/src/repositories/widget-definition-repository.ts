import { DatabaseService } from "../core";
import { WidgetDefinition, WidgetDefinitionData } from "../core/entities/widget-definition";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getWidgetDefinitionRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<WidgetDefinition, WidgetDefinitionData>(
    () => DatabaseCollection.WIDGET_DEFINITIONS,
    databaseService,
  );
}
