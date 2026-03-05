import {
	EmailTemplate,
	EmailTemplateData,
	EmailTemplateVersion,
	EmailTemplateVersionData,
} from "@/core";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";
import { getEmailTemplateVersionRepository } from "@/repositories/email-template-version-repository";
import { databaseService } from "./database/database-service";
import {
	logClientAuditFailure,
	logClientAuditSuccess,
} from "./audit-log/audit-log-client-helper";

// Email templates use Realtime Database for collaborative editing
const emailTemplateRepository = getEmailTemplateRealtimeRepository();
// Email template versions are stored on Firestore for historical records
const emailTemplateVersionRepository = getEmailTemplateVersionRepository(databaseService);

const toEmailTemplateData = (template: EmailTemplate): EmailTemplateData => {
	return {
		orgId: template.orgId,
		brandId: template.brandId,
		name: template.name,
		description: template.description,
		key: template.key,
		subject: template.subject,
		preheader: template.preheader,
		status: template.status,
		version: template.version,
		isSystemDefault: template.isSystemDefault,
		isLocked: template.isLocked,
		allowedContexts: template.allowedContexts ?? [],
		htmlContent: template.htmlContent ?? "",
		blocks: template.blocks ?? [],
		designTokens: template.designTokens,
		placeholders: template.placeholders ?? [],
		compatMode: template.compatMode,
		requirements: template.requirements,
		requirementsMeta: template.requirementsMeta,
		normalizationVersion: template.normalizationVersion,
		sections: template.sections,
		marketplaceTemplateId: template.marketplaceTemplateId,
	};
};

const isPermissionDeniedError = (error: unknown): boolean => {
	if (!error || typeof error !== "object") return false;
	const code = String((error as { code?: unknown }).code ?? "");
	return code === "permission-denied" || code.endsWith("/permission-denied");
};

const getNextVersionNumber = async (templateId: string): Promise<number> => {
	try {
		const versions = await emailTemplateVersionRepository.getAll({
			queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
			orderBy: { field: "version", direction: "desc" },
			pagination: { limit: 1 },
		});
		return versions.length > 0 ? versions[0].version + 1 : 1;
	} catch (error) {
		console.warn("[EMAIL-TEMPLATE-SERVICE] Falling back to unordered version lookup:", error);
		const versions = await emailTemplateVersionRepository.getAll({
			queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
		});
		const highestVersion = versions.reduce((max, item) => Math.max(max, item.version), 0);
		return highestVersion + 1;
	}
};

export const emailTemplateService = {
  list(orgId: string) {
    return emailTemplateRepository.getAll({
      queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
    });
  },
  get(id: string) {
    return emailTemplateRepository.get({ id });
  },
  async create(data: EmailTemplateData) {
    try {
      const id = await emailTemplateRepository.create({
        data: {
          ...data,
          compatMode: data.compatMode ?? "canonical_v1",
          normalizationVersion: data.normalizationVersion ?? "email_vm_v1",
        },
      });

      await logClientAuditSuccess({
        organizationId: data.orgId,
        action: "template.created",
        resource: {
          type: "email_template",
          id,
          name: data.name,
        },
        metadata: {
          sourceDetails: "emailTemplateService.create",
        },
      });

      return id;
    } catch (error) {
      await logClientAuditFailure({
        organizationId: data.orgId,
        action: "template.created",
        error,
        resource: {
          type: "email_template",
          id: "pending",
          name: data.name,
        },
        metadata: {
          sourceDetails: "emailTemplateService.create",
        },
      });
      throw error;
    }
  },
  async createDraft(data: EmailTemplateData) {
    // Create a draft template (same as create, but ensures status is draft)
    const draftData = {
      ...data,
      status: "draft" as const,
      compatMode: data.compatMode ?? "canonical_v1",
      normalizationVersion: data.normalizationVersion ?? "email_vm_v1",
    };
    return emailTemplateService.create(draftData);
  },
  updateDraft(id: string, data: Partial<EmailTemplateData>) {
    return emailTemplateRepository.update({ id, data });
  },
  update(id: string, data: Partial<EmailTemplateData>) {
    return emailTemplateRepository.update({ id, data });
  },
  async listVersions(templateId: string): Promise<EmailTemplateVersion[]> {
    if (!templateId) return [];
    try {
      return await emailTemplateVersionRepository.getAll({
        queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        return [];
      }

      console.warn("[EMAIL-TEMPLATE-SERVICE] Version query with orderBy failed, retrying:", error);
      const versions = await emailTemplateVersionRepository.getAll({
        queryConstraints: [{ field: "templateId", operator: "==", value: templateId }],
      });
      return versions.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }
  },
  async saveVersion(templateId: string, userId?: string, description?: string): Promise<{ versionId: string; version: number }> {
    let template: EmailTemplate | null = null;
    const startTime = Date.now();
    try {
      template = await emailTemplateRepository.get({ id: templateId });
      if (!template) {
        throw new Error("Template not found");
      }

      const nextVersionNumber = await getNextVersionNumber(templateId);
      const versionData: EmailTemplateVersionData = {
        templateId,
        version: nextVersionNumber,
        data: toEmailTemplateData(template),
        publishedAt: new Date().toISOString(),
        createdBy: userId,
        description,
      };

      const versionId = await emailTemplateVersionRepository.create({ data: versionData });

      await logClientAuditSuccess({
        organizationId: template.orgId,
        action: "template.version.created",
        resource: {
          type: "email_template",
          id: templateId,
          name: template.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "emailTemplateService.saveVersion",
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
              type: "email_template",
              id: templateId,
              name: template.name,
            }
          : undefined,
        metadata: {
          sourceDetails: "emailTemplateService.saveVersion",
        },
      });
      throw error;
    }
  },
  async restoreVersion(templateId: string, version: number): Promise<void> {
    let template: EmailTemplate | null = null;
    const startTime = Date.now();
    try {
      template = await emailTemplateRepository.get({ id: templateId });
      if (!template) {
        throw new Error("Template not found");
      }

      const versions = await emailTemplateService.listVersions(templateId);
      const versionToRestore = versions.find((item) => item.version === version);
      if (!versionToRestore) {
        throw new Error(`Version ${version} not found`);
      }

      const currentTemplateData = toEmailTemplateData(template);
      const restoreData = versionToRestore.data;
      const currentSerialized = JSON.stringify(currentTemplateData);
      const restoreSerialized = JSON.stringify(restoreData);

      if (currentSerialized !== restoreSerialized) {
        const backupVersionNumber = await getNextVersionNumber(templateId);
        const backupVersionData: EmailTemplateVersionData = {
          templateId,
          version: backupVersionNumber,
          data: currentTemplateData,
          publishedAt: new Date().toISOString(),
          description: `Auto-saved before restoring version ${version}`,
        };
        await emailTemplateVersionRepository.create({ data: backupVersionData });
      }

      await emailTemplateRepository.update({
        id: templateId,
        data: restoreData,
      });

      await logClientAuditSuccess({
        organizationId: template.orgId,
        action: "template.version.restored",
        resource: {
          type: "email_template",
          id: templateId,
          name: template.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "emailTemplateService.restoreVersion",
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
              type: "email_template",
              id: templateId,
              name: template.name,
            }
          : undefined,
        metadata: {
          sourceDetails: "emailTemplateService.restoreVersion",
          customFields: {
            requestedVersion: version,
          },
        },
      });
      throw error;
    }
  },
  async delete(id: string, organizationId?: string) {
    let template: EmailTemplate | null = null;
    const startTime = Date.now();
    try {
      template = await emailTemplateRepository.get({ id });

      await emailTemplateRepository.delete({ id });

      await logClientAuditSuccess({
        organizationId: template?.orgId ?? organizationId,
        action: "template.deleted",
        resource: {
          type: "email_template",
          id,
          name: template?.name,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          sourceDetails: "emailTemplateService.delete",
        },
      });
    } catch (error) {
      await logClientAuditFailure({
        organizationId: template?.orgId ?? organizationId,
        action: "template.deleted",
        error,
        durationMs: Date.now() - startTime,
        resource: {
          type: "email_template",
          id,
          name: template?.name,
        },
        metadata: {
          sourceDetails: "emailTemplateService.delete",
        },
      });
      throw error;
    }
  },
};

export type EmailTemplateService = typeof emailTemplateService;
