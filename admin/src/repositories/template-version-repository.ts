import { DatabaseService, TemplateVersion, TemplateVersionData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getTemplateVersionRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<TemplateVersion, TemplateVersionData>(
    () => DatabaseCollection.TEMPLATE_VERSIONS,
    databaseService,
  );
}


