import { EmailTemplate, EmailTemplateData } from "../../../core/entities/email-template";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class EmailTemplateDuplicator extends BaseDuplicator<EmailTemplate, EmailTemplateData> {
  async duplicate(
    entity: EmailTemplate,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: EmailTemplateData; newId: string }> {
    const entityData: EmailTemplateData = {
      orgId: entity.orgId,
      brandId: entity.brandId,
      name: entity.name,
      description: entity.description,
      key: entity.key,
      subject: entity.subject,
      preheader: entity.preheader,
      status: entity.status,
      version: entity.version,
      isSystemDefault: entity.isSystemDefault,
      isLocked: entity.isLocked,
      allowedContexts: entity.allowedContexts,
      htmlContent: entity.htmlContent,
      blocks: entity.blocks,
      designTokens: entity.designTokens,
      placeholders: entity.placeholders,
      sections: entity.sections,
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: "" };
  }

  resetIdentityFields(
    data: EmailTemplateData,
    targetOrgId: string,
    createdBy: string,
  ): EmailTemplateData {
    return {
      ...data,
      orgId: targetOrgId,
      brandId: undefined,
      status: "draft",
      version: 1,
      isSystemDefault: false,
      isLocked: false,
    };
  }

  resolveReferences(
    data: EmailTemplateData,
    idMapping: IdMappingTable,
  ): EmailTemplateData {
    return data;
  }

  handleConflict(
    data: EmailTemplateData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): EmailTemplateData {
    if (conflictType === "name") {
      return {
        ...data,
        name: this.generateConflictSuffix(data.name, options),
      };
    }
    return data;
  }
}
