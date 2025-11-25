import { DatabaseService, EmailTemplate, EmailTemplateData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getEmailTemplateRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<EmailTemplate, EmailTemplateData>(
    () => DatabaseCollection.EMAIL_TEMPLATES,
    databaseService,
  );
}


