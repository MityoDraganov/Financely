import { DatabaseService, EmailTemplateVersion, EmailTemplateVersionData } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getEmailTemplateVersionRepository(databaseService: DatabaseService) {
	return getGenericRepository<EmailTemplateVersion, EmailTemplateVersionData>(
		() => DatabaseCollection.EMAIL_TEMPLATE_VERSIONS,
		databaseService,
	);
}
