import { DatabaseService, Template, TemplateData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { TemplateRepository } from "@/core/ports/repositories/template-reposity";

export function getTemplateRepository(
  databaseService: DatabaseService,
): TemplateRepository {
  return getGenericRepository<Template, TemplateData>(
    () => DatabaseCollection.TEMPLATES,
    databaseService,
  );
}


