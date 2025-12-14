import { Template, TemplateData, TemplateVersion, TemplateVersionData } from "@/core";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import { getTemplateVersionRepository } from "@/repositories/template-version-repository";
import { databaseService } from "./database/database-service";

export type TemplateService = {
  getTemplate: (id: string) => Promise<Template | null>;
  listTemplates: (orgId: string) => Promise<Template[]>;
  createDraft: (data: TemplateData) => Promise<string>;
  updateDraft: (id: string, data: Partial<TemplateData>) => Promise<void>;
  publish: (id: string) => Promise<{ versionId: string; version: number }>; 
  listVersions: (templateId: string) => Promise<TemplateVersion[]>;
  saveVersion: (templateId: string, userId?: string, description?: string) => Promise<{ versionId: string; version: number }>;
  restoreVersion: (templateId: string, version: number) => Promise<void>;
};

// Templates use Realtime Database for collaborative editing
const templateRepository = getTemplateRealtimeRepository();
// Versions stay on Firestore for historical records
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

    const { orgId, name, description, pageSize, brand, elements, status, compliance, productTableConfig } = template;
    const templateDataOnly: TemplateData = {
      orgId,
      name,
      description,
      pageSize,
      brand,
      elements,
      status,
      compliance,
      ...(productTableConfig !== undefined && { productTableConfig }),
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
    if (!templateId) {
      console.warn("listVersions called without templateId");
      return [];
    }
    console.log("listVersions called with templateId:", templateId);
    try {
      const result = await templateVersionRepository.getAll({
        queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
        orderBy: { field: "createdAt", direction: "desc" },
      });
      console.log("listVersions result:", result, "count:", result.length);
      return result;
    } catch (error) {
      console.error("Error fetching template versions:", error);
      // If query fails (e.g., missing index), try without orderBy as fallback
      try {
        console.log("Retrying without orderBy...");
        const result = await templateVersionRepository.getAll({
          queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
        });
        // Sort manually
        const sorted = result.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        console.log("listVersions fallback result:", sorted, "count:", sorted.length);
        return sorted;
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        throw error; // Throw original error
      }
    }
  },

  async saveVersion(templateId, userId, description) {
    const template = await templateRepository.get({ id: templateId });
    if (!template) {
      throw new Error("Template not found");
    }

    // Get existing versions to determine next version number
    const versions = await templateVersionRepository.getAll({
      queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
      orderBy: { field: "version", direction: "desc" },
      pagination: { limit: 1 },
    });

    const nextVersionNumber = versions.length > 0 ? versions[0].version + 1 : 1;

    // Extract template data
    const { orgId, name, description: templateDescription, pageSize, brand, elements, status, compliance, productTableConfig } = template;
    const templateDataOnly: TemplateData = {
      orgId,
      name,
      description: templateDescription,
      pageSize,
      brand,
      elements,
      status,
      compliance,
      ...(productTableConfig !== undefined && { productTableConfig }),
    };

    const versionData: TemplateVersionData = {
      templateId,
      version: nextVersionNumber,
      data: templateDataOnly,
      publishedAt: new Date().toISOString(),
      createdBy: userId,
      description,
    };

    const versionId = await templateVersionRepository.create({ data: versionData });

    return { versionId, version: nextVersionNumber };
  },

  async restoreVersion(templateId, version) {
    const template = await templateRepository.get({ id: templateId });
    if (!template) {
      throw new Error("Template not found");
    }

    // Get the version to restore
    const versions = await templateVersionRepository.getAll({
      queryConstraints: [
        { field: "templateId", operator: "==", value: templateId },
        { field: "version", operator: "==", value: version },
      ],
    });

    if (versions.length === 0) {
      throw new Error(`Version ${version} not found`);
    }

    const versionToRestore = versions[0];

    // Save current template state as a new version before restoring
    // This ensures we don't lose the current state
    const currentVersions = await templateVersionRepository.getAll({
      queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
      orderBy: { field: "version", direction: "desc" },
      pagination: { limit: 1 },
    });
    const currentVersionNumber = currentVersions.length > 0 ? currentVersions[0].version : 0;

    // Only save current state if it's different from the version we're restoring
    if (currentVersionNumber !== version) {
      const { orgId, name, description, pageSize, brand, elements, status, compliance, productTableConfig } = template;
      const currentTemplateData: TemplateData = {
        orgId,
        name,
        description,
        pageSize,
        brand,
        elements,
        status,
        compliance,
        ...(productTableConfig !== undefined && { productTableConfig }),
      };

      // Check if current state is different from the version being restored
      const currentDataStr = JSON.stringify(currentTemplateData);
      const restoreDataStr = JSON.stringify(versionToRestore.data);
      
      if (currentDataStr !== restoreDataStr) {
        // Save current state as a version before restoring
        const backupVersionData: TemplateVersionData = {
          templateId,
          version: currentVersionNumber + 1,
          data: currentTemplateData,
          publishedAt: new Date().toISOString(),
          description: `Auto-saved before restoring version ${version}`,
        };
        await templateVersionRepository.create({ data: backupVersionData });
      }
    }

    // Restore the version data to the template
    await templateRepository.update({
      id: templateId,
      data: {
        ...versionToRestore.data,
        // Keep the template ID and don't overwrite status unless it was in the version
      },
    });
  },
};


