import {
	EmailTemplate,
	EmailTemplateData,
	EmailTemplateVersion,
	EmailTemplateVersionData,
} from "@/core";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";
import { getEmailTemplateVersionRepository } from "@/repositories/email-template-version-repository";
import { databaseService } from "./database/database-service";

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
		sections: template.sections,
		marketplaceTemplateId: template.marketplaceTemplateId,
	};
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
  create(data: EmailTemplateData) {
    return emailTemplateRepository.create({ data });
  },
  createDraft(data: EmailTemplateData) {
    // Create a draft template (same as create, but ensures status is draft)
    const draftData = {
      ...data,
      status: "draft" as const,
    };
    return emailTemplateRepository.create({ data: draftData });
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
    const template = await emailTemplateRepository.get({ id: templateId });
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
    return { versionId, version: nextVersionNumber };
  },
  async restoreVersion(templateId: string, version: number): Promise<void> {
    const template = await emailTemplateRepository.get({ id: templateId });
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
  },
  delete(id: string) {
    return emailTemplateRepository.delete({ id });
  },
};

export type EmailTemplateService = typeof emailTemplateService;

