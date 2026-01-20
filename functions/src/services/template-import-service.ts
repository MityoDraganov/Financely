import { DatabaseService } from "../core";
import { TemplateData } from "../core/entities/template";
import { EmailTemplateData } from "../core/entities/email-template";
import { MarketplaceTemplate } from "../core/entities/marketplace-template";
import { loggerService } from "./logger-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";

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
        const invoiceTemplateData = templateContent as TemplateData;

        // Check for existing templates with the same name in Realtime Database
        const allTemplates = await realtimeDatabaseService.getAll<TemplateData & { id: string }>(
          "templates",
          { orderBy: "orgId", equalTo: orgId }
        );
        
        const existingTemplates = allTemplates.filter(
          (t) => t.name === invoiceTemplateData.name || 
                 t.marketplaceTemplateId === marketplaceTemplate.id
        );

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
          marketplaceTemplateId: marketplaceTemplate.id, // Store marketplace template ID
        };

        // Write to Realtime Database (where frontend reads from)
        const createdId = await realtimeDatabaseService.create<TemplateData>(
          "templates",
          newTemplateData
        );
        
        loggerService.info("Template imported to Realtime Database", {
          templateId: createdId,
          orgId,
          marketplaceTemplateId: marketplaceTemplate.id,
        });
        
        return { id: createdId, name: templateName, renamed };
      } else {
        // Email template
        const emailTemplateData = templateContent as EmailTemplateData;

        // Check for existing email templates with the same name in Realtime Database
        const allEmailTemplates = await realtimeDatabaseService.getAll<EmailTemplateData & { id: string }>(
          "emailTemplates",
          { orderBy: "orgId", equalTo: orgId }
        );
        
        const existingTemplates = allEmailTemplates.filter(
          (t) => t.name === emailTemplateData.name || 
                 t.marketplaceTemplateId === marketplaceTemplate.id
        );

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
          marketplaceTemplateId: marketplaceTemplate.id, // Store marketplace template ID
        };

        // Write to Realtime Database (where frontend reads from)
        const createdId = await realtimeDatabaseService.create<EmailTemplateData>(
          "emailTemplates",
          newTemplateData
        );
        
        loggerService.info("Email template imported to Realtime Database", {
          templateId: createdId,
          orgId,
          marketplaceTemplateId: marketplaceTemplate.id,
        });
        
        return { id: createdId, name: templateName, renamed };
      }
  },
};
