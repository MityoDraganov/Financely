import { EmailTemplateMapping, EmailTemplateMappingData } from "../../../core/entities/email-template-mapping";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class EmailTemplateMappingDuplicator extends BaseDuplicator<EmailTemplateMapping, EmailTemplateMappingData> {
  async duplicate(
    entity: EmailTemplateMapping,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: EmailTemplateMappingData; newId: string }> {
    const entityData: EmailTemplateMappingData = {
      orgId: entity.orgId,
      emailTemplateId: entity.emailTemplateId,
      entityTemplateId: entity.entityTemplateId,
      entityType: entity.entityType,
      mappings: entity.mappings,
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: "" };
  }

  resetIdentityFields(
    data: EmailTemplateMappingData,
    targetOrgId: string,
    createdBy: string,
  ): EmailTemplateMappingData {
    return {
      ...data,
      orgId: targetOrgId,
    };
  }

  resolveReferences(
    data: EmailTemplateMappingData,
    idMapping: IdMappingTable,
  ): EmailTemplateMappingData {
    // Resolve email template ID
    const newEmailTemplateId = idMapping.getNewId(data.emailTemplateId);
    if (newEmailTemplateId) {
      data.emailTemplateId = newEmailTemplateId;
    }

    // Resolve entity template ID
    const newEntityTemplateId = idMapping.getNewId(data.entityTemplateId);
    if (newEntityTemplateId) {
      data.entityTemplateId = newEntityTemplateId;
    }

    return data;
  }

  handleConflict(
    data: EmailTemplateMappingData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): EmailTemplateMappingData {
    return data;
  }
}
