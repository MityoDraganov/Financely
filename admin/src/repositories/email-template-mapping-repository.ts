import { DatabaseService, EmailTemplateMapping, EmailTemplateMappingData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getEmailTemplateMappingRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<EmailTemplateMapping, EmailTemplateMappingData>(
    () => DatabaseCollection.EMAIL_TEMPLATE_MAPPINGS,
    databaseService,
  );
}

