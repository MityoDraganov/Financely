import { Template, TemplateData } from "../../../core/entities/template";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class TemplateDuplicator extends BaseDuplicator<Template, TemplateData> {
  async duplicate(
    entity: Template,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: TemplateData; newId: string }> {
    const entityData: TemplateData = {
      orgId: entity.orgId,
      name: entity.name,
      description: entity.description,
      pageSize: entity.pageSize,
      brand: entity.brand,
      elements: entity.elements,
      backgroundElements: entity.backgroundElements ?? [],
      status: entity.status,
      compliance: entity.compliance,
      productTableConfig: entity.productTableConfig,
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: "" };
  }

  resetIdentityFields(
    data: TemplateData,
    targetOrgId: string,
    createdBy: string,
  ): TemplateData {
    return {
      ...data,
      orgId: targetOrgId,
      status: "draft",
    };
  }

  resolveReferences(
    data: TemplateData,
    idMapping: IdMappingTable,
  ): TemplateData {
    return data;
  }

  handleConflict(
    data: TemplateData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): TemplateData {
    if (conflictType === "name") {
      return {
        ...data,
        name: this.generateConflictSuffix(data.name, options),
      };
    }
    return data;
  }
}
