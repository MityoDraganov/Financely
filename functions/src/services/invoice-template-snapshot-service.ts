import { DatabaseService } from "../core";
import { Template, TemplateData, TemplateVersion } from "../core/entities/template";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";

const TEMPLATE_VERSIONS_COLLECTION = "templateVersions";

export function toTemplateSnapshot(template: Template): TemplateData {
  // Strip entity metadata so invoices store only immutable template content.
  const templateData = { ...template } as Partial<Template>;
  delete templateData.id;
  delete templateData.createdAt;
  delete templateData.updatedAt;
  return templateData as TemplateData;
}

export async function loadTemplateSnapshotFromVersionId(params: {
  databaseService: DatabaseService;
  templateVersionId: string;
  templateId: string;
  orgId: string;
}): Promise<TemplateData | null> {
  const templateVersion = await params.databaseService.get<TemplateVersion>(
    TEMPLATE_VERSIONS_COLLECTION,
    params.templateVersionId
  );
  if (!templateVersion) return null;

  if (templateVersion.templateId !== params.templateId) {
    throw new Error(
      `Template version ${params.templateVersionId} does not belong to template ${params.templateId}`
    );
  }

  if (templateVersion.data.orgId !== params.orgId) {
    throw new Error("Template version does not belong to this organization");
  }

  return templateVersion.data;
}

export async function loadLatestTemplateSnapshotVersion(params: {
  databaseService: DatabaseService;
  templateId: string;
  orgId: string;
}): Promise<TemplateData | null> {
  const versions = await params.databaseService.getAllByFields<TemplateVersion>(
    TEMPLATE_VERSIONS_COLLECTION,
    [{ field: "templateId", operator: "==", value: params.templateId }],
    { limit: 1 },
    { field: "version", direction: "desc" }
  );

  const latest = versions[0];
  if (!latest) return null;

  if (latest.data.orgId !== params.orgId) {
    throw new Error("Template version does not belong to this organization");
  }

  return latest.data;
}

export async function loadLiveTemplateSnapshot(params: {
  templateId: string;
  orgId: string;
}): Promise<TemplateData | null> {
  const template = await realtimeDatabaseService.get<Template>("templates", params.templateId);
  if (!template) return null;

  if (template.orgId !== params.orgId) {
    throw new Error("Template does not belong to this organization");
  }

  return toTemplateSnapshot(template);
}
