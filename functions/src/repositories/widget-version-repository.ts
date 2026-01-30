import { DatabaseService } from "../core";
import { WidgetVersion, WidgetVersionData } from "../core/entities/widget-version";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getWidgetVersionRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<WidgetVersion, WidgetVersionData>(
    () => DatabaseCollection.WIDGET_VERSIONS,
    databaseService,
  );
}
