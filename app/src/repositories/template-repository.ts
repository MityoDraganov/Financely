import { DatabaseService, Template, TemplateData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getTemplateRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<Template, TemplateData>(
    () => DatabaseCollection.TEMPLATES,
    databaseService,
  );
}


