import { DatabaseService } from "../core";
import { EmailTemplate, EmailTemplateData } from "../core/entities/email-template";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for an EmailTemplateRepository backed by the provided DatabaseService.
 */
export function getEmailTemplateRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<EmailTemplate, EmailTemplateData>(
    () => DatabaseCollection.EMAIL_TEMPLATES,
    databaseService,
  );
}
