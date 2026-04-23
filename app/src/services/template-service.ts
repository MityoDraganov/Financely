import { Template, TemplateData, TemplateElement, TemplateVersion, TemplateVersionData } from "@/core";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import { getTemplateVersionRepository } from "@/repositories/template-version-repository";
import { databaseService } from "./database/database-service";
import {
  logClientAuditFailure,
  logClientAuditSuccess,
} from "./audit-log/audit-log-client-helper";
import { resolveBinding } from "@/utils/binding-resolution";

export type TemplateService = {
  getTemplate: (id: string) => Promise<Template | null>;
  listTemplates: (orgId: string) => Promise<Template[]>;
  createDraft: (data: TemplateData) => Promise<string>;
  updateDraft: (id: string, data: Partial<TemplateData>) => Promise<void>;
  publish: (id: string) => Promise<{ versionId: string; version: number }>; 
  listVersions: (templateId: string) => Promise<TemplateVersion[]>;
  saveVersion: (templateId: string, userId?: string, description?: string) => Promise<{ versionId: string; version: number }>;
  restoreVersion: (templateId: string, version: number) => Promise<void>;
  delete: (id: string, organizationId?: string) => Promise<void>;
};

// Templates use Realtime Database for collaborative editing
const templateRepository = getTemplateRealtimeRepository();
// Versions stay on Firestore for historical records
const templateVersionRepository = getTemplateVersionRepository(databaseService);

function enrichElementsWithFieldId(elements: TemplateElement[]): TemplateElement[] {
  return elements.map((element) => {
    const current = element as TemplateElement & {
      fieldId?: string;
      binding?: string;
      itemsBinding?: string;
      isCustomBinding?: boolean;
    };

    if (current.fieldId) return element;

    const bindingToCheck =
      current.type === "table" ? current.itemsBinding : current.binding;
    const result = resolveBinding(bindingToCheck);

    if (result.resolved !== "unknown" && result.fieldId) {
      return {
        ...element,
        fieldId: result.fieldId,
        isCustomBinding: false,
      } as TemplateElement;
    }

    return {
      ...element,
      isCustomBinding: true,
    } as TemplateElement;
  });
}

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
    try {
      const id = await templateRepository.create({
        data: {
          ...data,
          status: "draft",
          elements: enrichElementsWithFieldId(data.elements ?? []),
          backgroundElements: enrichElementsWithFieldId(data.backgroundElements ?? []),
        },
      });

      await logClientAuditSuccess({
        organizationId: data.orgId,
        action: "template.created",
        resource: {
          type: "template",
          id,
          name: data.name,
        },
        metadata: {
          sourceDetails: "templateService.createDraft",
        },
      });

      return id;
    } catch (error) {
      await logClientAuditFailure({
        organizationId: data.orgId,
        action: "template.created",
        error,
        resource: {
          type: "template",
          id: "pending",
          name: data.name,
        },
        metadata: {
          sourceDetails: "templateService.createDraft",
        },
      });
      throw error;
    }
  },

  async updateDraft(id, data) {
    const nextData = {
      ...data,
      ...(data.elements
        ? { elements: enrichElementsWithFieldId(data.elements) }
        : {}),
      ...(data.backgroundElements
        ? { backgroundElements: enrichElementsWithFieldId(data.backgroundElements) }
        : {}),
    };
    return templateRepository.update({ id, data: nextData });
  },

  async publish(id) {
    let template: Template | null = null;
    const startTime = Date.now();
    try {
      template = await templateRepository.get({ id });
      if (!template) {
        throw new Error("Template not found");
      }

      const versions = await templateVersionRepository.getAll({
        queryConstraints: [{ field: "templateId", operator: "==", value: id }],
        orderBy: { field: "createdAt", direction: "desc" },
        pagination: { limit: 1 },
      });

      const nextVersionNumber = versions.length > 0 ? versions[0].version + 1 : 1;

      const { orgId, name, description, pageSize, brand, elements, backgroundElements, status, compliance, productTableConfig } = template;
      const templateDataOnly: TemplateData = {
        orgId,
        name,
        description,
        pageSize,
        brand,
        elements,
        backgroundElements,
        status,
        ...(compliance !== undefined && { compliance }),
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

      await logClientAuditSuccess({
        organizationId: orgId,
        action: "template.published",
        resource: {
          type: "template",
          id,
          name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "templateService.publish",
          customFields: {
            versionId,
            version: nextVersionNumber,
          },
        },
      });

      return { versionId, version: nextVersionNumber };
    } catch (error) {
      await logClientAuditFailure({
        organizationId: template?.orgId,
        action: "template.published",
        error,
        durationMs: Date.now() - startTime,
        resource: template
          ? {
              type: "template",
              id,
              name: template.name,
            }
          : undefined,
        metadata: {
          sourceDetails: "templateService.publish",
        },
      });
      throw error;
    }
  },

  async listVersions(templateId) {
    if (!templateId) {
      return [];
    }
    try {
      return await templateVersionRepository.getAll({
        queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    } catch (error) {
      console.error("Error fetching template versions:", error);
      // If query fails (e.g., missing index), try without orderBy as fallback
      try {
        const result = await templateVersionRepository.getAll({
          queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
        });
        // Sort manually
        const sorted = result.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        return sorted;
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        throw error; // Throw original error
      }
    }
  },

  async saveVersion(templateId, userId, description) {
    let template: Template | null = null;
    const startTime = Date.now();
    try {
      template = await templateRepository.get({ id: templateId });
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
      const { orgId, name, description: templateDescription, pageSize, brand, elements, backgroundElements: bgElements, status, compliance, productTableConfig } = template;
      const templateDataOnly: TemplateData = {
        orgId,
        name,
        description: templateDescription,
        pageSize,
        brand,
        elements,
        backgroundElements: bgElements,
        status,
        ...(compliance !== undefined && { compliance }),
        ...(productTableConfig !== undefined && { productTableConfig }),
      };

      const versionData: TemplateVersionData = {
        templateId,
        version: nextVersionNumber,
        data: templateDataOnly,
        publishedAt: new Date().toISOString(),
        ...(userId !== undefined && { createdBy: userId }),
        ...(description !== undefined && { description }),
      };

      const versionId = await templateVersionRepository.create({ data: versionData });

      await logClientAuditSuccess({
        organizationId: template.orgId,
        action: "template.version.created",
        resource: {
          type: "template",
          id: templateId,
          name: template.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "templateService.saveVersion",
          customFields: {
            versionId,
            version: nextVersionNumber,
            description: description || null,
          },
        },
      });

      return { versionId, version: nextVersionNumber };
    } catch (error) {
      await logClientAuditFailure({
        organizationId: template?.orgId,
        action: "template.version.created",
        error,
        durationMs: Date.now() - startTime,
        resource: template
          ? {
              type: "template",
              id: templateId,
              name: template.name,
            }
          : undefined,
        metadata: {
          sourceDetails: "templateService.saveVersion",
        },
      });
      throw error;
    }
  },

  async restoreVersion(templateId, version) {
    let template: Template | null = null;
    const startTime = Date.now();
    try {
      template = await templateRepository.get({ id: templateId });
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
      const { orgId, name, description, pageSize, brand, elements, backgroundElements: bgElementsCurrent, status, compliance, productTableConfig } = template;
      const currentTemplateData: TemplateData = {
        orgId,
        name,
        description,
        pageSize,
        brand,
        elements,
        backgroundElements: bgElementsCurrent,
        status,
        ...(compliance !== undefined && { compliance }),
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

      await logClientAuditSuccess({
        organizationId: template.orgId,
        action: "template.version.restored",
        resource: {
          type: "template",
          id: templateId,
          name: template.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "templateService.restoreVersion",
          customFields: {
            restoredVersion: version,
          },
        },
      });
    } catch (error) {
      await logClientAuditFailure({
        organizationId: template?.orgId,
        action: "template.version.restored",
        error,
        durationMs: Date.now() - startTime,
        resource: template
          ? {
              type: "template",
              id: templateId,
              name: template.name,
            }
          : undefined,
        metadata: {
          sourceDetails: "templateService.restoreVersion",
          customFields: {
            requestedVersion: version,
          },
        },
      });
      throw error;
    }
  },

  async delete(id, organizationId) {
    let template: Template | null = null;
    const startTime = Date.now();
    try {
      template = await templateRepository.get({ id });

      await templateRepository.delete({ id });

      await logClientAuditSuccess({
        organizationId: template?.orgId ?? organizationId,
        action: "template.deleted",
        resource: {
          type: "template",
          id,
          name: template?.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "templateService.delete",
        },
      });
    } catch (error) {
      await logClientAuditFailure({
        organizationId: template?.orgId ?? organizationId,
        action: "template.deleted",
        error,
        durationMs: Date.now() - startTime,
        resource: {
          type: "template",
          id,
          name: template?.name,
        },
        metadata: {
          sourceDetails: "templateService.delete",
        },
      });
      throw error;
    }
  },
};
