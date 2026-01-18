import { DatabaseService } from "../core";
import { EmailTemplateMapping, EmailTemplateMappingData } from "../core/entities/email-template-mapping";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for an EmailTemplateMappingRepository backed by the provided DatabaseService.
 */
export function getEmailTemplateMappingRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<EmailTemplateMapping, EmailTemplateMappingData>(
    () => DatabaseCollection.EMAIL_TEMPLATE_MAPPINGS,
    databaseService,
  );
}
