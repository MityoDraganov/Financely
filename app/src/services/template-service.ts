import { Template, TemplateData, TemplateVersion, TemplateVersionData } from "@/core";
import { getTemplateRepository } from "@/repositories/template-repository";
import { getTemplateVersionRepository } from "@/repositories/template-version-repository";
import { databaseService } from "./database/database-service";

export type TemplateService = {
  getTemplate: (id: string) => Promise<Template | null>;
  listTemplates: (orgId: string) => Promise<Template[]>;
  createDraft: (data: TemplateData) => Promise<string>;
  updateDraft: (id: string, data: Partial<TemplateData>) => Promise<void>;
  publish: (id: string) => Promise<{ versionId: string; version: number }>; 
  listVersions: (templateId: string) => Promise<TemplateVersion[]>;
};

const templateRepository = getTemplateRepository(databaseService);
const templateVersionRepository = getTemplateVersionRepository(databaseService);

export const templateService: TemplateService = {
  async getTemplate(id) {
    return templateRepository.get({ id });
  },

  async listTemplates(orgId) {
    return templateRepository.getAll({
      queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
    });
  },

  async createDraft(data) {
    return templateRepository.create({ data: { ...data, status: "draft" } });
  },

  async updateDraft(id, data) {
    return templateRepository.update({ id, data });
  },

  async publish(id) {
    const template = await templateRepository.get({ id });
    if (!template) {
      throw new Error("Template not found");
    }

    const versions = await templateVersionRepository.getAll({
      queryConstraints: [{ field: "templateId", operator: "==", value: id }],
      orderBy: { field: "createdAt", direction: "desc" },
      pagination: { limit: 1 },
    });

    const nextVersionNumber = versions.length > 0 ? versions[0].version + 1 : 1;

    const { orgId, name, description, pageSize, brand, elements, status } = template;
    const templateDataOnly: TemplateData = {
      orgId,
      name,
      description,
      pageSize,
      brand,
      elements,
      status,
    };

    const versionData: TemplateVersionData = {
      templateId: id,
      version: nextVersionNumber,
      data: templateDataOnly,
      publishedAt: new Date().toISOString(),
    };

    const versionId = await templateVersionRepository.create({ data: versionData });

    await templateRepository.update({ id, data: { status: "published" } });

    return { versionId, version: nextVersionNumber };
  },

  async listVersions(templateId) {
    return templateVersionRepository.getAll({
      queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
      orderBy: { field: "createdAt", direction: "desc" },
    });
  },
};


