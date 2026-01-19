import { DatabaseService } from "../core";
import { TemplateData } from "../core/entities/template";
import { EmailTemplateData } from "../core/entities/email-template";
import { MarketplaceTemplate } from "../core/entities/marketplace-template";
import { getTemplateRepository } from "../repositories/template-repository";
import { getEmailTemplateRepository } from "../repositories/email-template-repository";
import { loggerService } from "./logger-service";

export interface TemplateImportService {
  /**
   * Import a marketplace template into an organization
   */
  importTemplate(
    marketplaceTemplate: MarketplaceTemplate,
    orgId: string,
    databaseService: DatabaseService
  ): Promise<{ id: string; name: string; renamed: boolean }>;
}

export const templateImportService: TemplateImportService = {
  async importTemplate(
    marketplaceTemplate: MarketplaceTemplate,
    orgId: string,
    databaseService: DatabaseService
  ): Promise<{ id: string; name: string; renamed: boolean }> {
      const templateContent = marketplaceTemplate.templateContent as TemplateData | EmailTemplateData;
      let renamed = false;

      if (marketplaceTemplate.type === "invoice") {
        const templateRepo = getTemplateRepository(databaseService);
        const invoiceTemplateData = templateContent as TemplateData;

      // Check for existing templates with the same name
      const existingTemplates = await templateRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "name", operator: "==", value: invoiceTemplateData.name },
        ],
      });

      let templateName = invoiceTemplateData.name;
      if (existingTemplates.length > 0) {
        // Auto-rename to avoid conflicts
        templateName = `${invoiceTemplateData.name} (Imported)`;
        renamed = true;
        loggerService.info("Template name conflict resolved", {
          originalName: invoiceTemplateData.name,
          newName: templateName,
          orgId,
        });
      }

      const newTemplateData: TemplateData = {
        ...invoiceTemplateData,
        orgId,
        name: templateName,
        status: "draft",
      };

      const createdId = await templateRepo.create({ data: newTemplateData });
      return { id: createdId, name: templateName, renamed };
    } else {
      // Email template
      const emailTemplateRepo = getEmailTemplateRepository(databaseService);
      const emailTemplateData = templateContent as EmailTemplateData;

      // Check for existing email templates with the same name
      const existingTemplates = await emailTemplateRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "name", operator: "==", value: emailTemplateData.name },
        ],
      });

      let templateName = emailTemplateData.name;
      if (existingTemplates.length > 0) {
        templateName = `${emailTemplateData.name} (Imported)`;
        renamed = true;
        loggerService.info("Email template name conflict resolved", {
          originalName: emailTemplateData.name,
          newName: templateName,
          orgId,
        });
      }

      const newTemplateData: EmailTemplateData = {
        ...emailTemplateData,
        orgId,
        name: templateName,
        status: "draft",
      };

      const createdId = await emailTemplateRepo.create({ data: newTemplateData });
      return { id: createdId, name: templateName, renamed };
    }
  },
};
