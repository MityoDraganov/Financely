import { getFirestore } from "firebase-admin/firestore";
import type { TemplateData } from "../core/entities/template";
import {
  emailTemplateDataSchema,
  type EmailTemplateData,
} from "../core/entities/email-template";
import {
  marketplaceTemplateDataSchema,
  type OfficialGenerationMeta,
  type MarketplaceTemplate,
} from "../core/entities/marketplace-template";
import { templateDataSchema } from "../core/entities/template";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { getMarketplaceTemplateVersionRepository } from "../repositories/marketplace-template-version-repository";
import type { OfficialTemplateBlueprint } from "./schemas";
import {
  toMarketplaceTemplateData,
  toMarketplaceTemplateVersionData,
} from "./schemas";

export type CanonicalGeneratedTemplate = TemplateData | EmailTemplateData;

export type UpsertOfficialTemplateDraftParams = {
  blueprint: OfficialTemplateBlueprint;
  templateContent: CanonicalGeneratedTemplate;
  authorId: string;
  authorName: string;
  overwriteExisting: boolean;
  dryRun: boolean;
  officialGenerationMeta?: OfficialGenerationMeta;
};

export type UpsertOfficialTemplateDraftResult = {
  stored: boolean;
  templateId?: string;
  skippedReason?: string;
};

export async function getAdminDisplayName(userId: string): Promise<string> {
  const db = getFirestore();
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return "Financely Team";
  }

  const data = userDoc.data() || {};
  const nameValue = typeof data.name === "string" ? data.name.trim() : "";
  const emailValue = typeof data.email === "string" ? data.email.trim() : "";
  return nameValue || emailValue || "Financely Team";
}

export function parseCanonicalTemplateContent(
  type: "invoice" | "email",
  content: unknown,
): CanonicalGeneratedTemplate {
  if (type === "invoice") {
    return templateDataSchema.parse(content);
  }
  return emailTemplateDataSchema.parse(content);
}

export function parseMarketplaceTemplateEntityData(
  template: MarketplaceTemplate,
): ReturnType<typeof marketplaceTemplateDataSchema.parse> {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = template;
  void _id;
  void _createdAt;
  void _updatedAt;
  return marketplaceTemplateDataSchema.parse(data);
}

export async function upsertOfficialTemplateDraft(
  params: UpsertOfficialTemplateDraftParams,
): Promise<UpsertOfficialTemplateDraftResult> {
  const {
    blueprint,
    templateContent,
    authorId,
    authorName,
    overwriteExisting,
    dryRun,
    officialGenerationMeta,
  } = params;

  if (dryRun) {
    return { stored: false };
  }

  const databaseService = getDatabaseService();
  const templateRepo = getMarketplaceTemplateRepository(databaseService);
  const versionRepo = getMarketplaceTemplateVersionRepository(databaseService);
  const now = new Date().toISOString();

  const existing = await templateRepo.getAll({
    queryConstraints: [
      { field: "sourceTemplateId", operator: "==", value: blueprint.id },
      { field: "type", operator: "==", value: blueprint.type },
      { field: "isOfficial", operator: "==", value: true },
    ],
    pagination: { limit: 1 },
  });

  const templateContentRecord = templateContent as unknown as Record<string, unknown>;

  if (existing.length > 0) {
    const existingTemplate = existing[0];
    if (!overwriteExisting) {
      return {
        stored: false,
        templateId: existingTemplate.id,
        skippedReason: "Template exists and overwriteExisting is false",
      };
    }

    const nextVersion = (existingTemplate.version || 1) + 1;
    const versionData = toMarketplaceTemplateVersionData({
      marketplaceTemplateId: existingTemplate.id,
      version: nextVersion,
      type: blueprint.type,
      title: blueprint.title,
      templateContent: templateContentRecord,
      sourceTemplateId: blueprint.id,
      sourceTemplateType: blueprint.type,
      createdBy: authorId,
      publishedAt: now,
      changelog: "Official template pack regeneration",
    });
    const versionId = await versionRepo.create({ data: versionData });

    const updateData = toMarketplaceTemplateData({
      ...parseMarketplaceTemplateEntityData(existingTemplate),
      title: blueprint.title,
      shortDescription: blueprint.shortDescription,
      description: blueprint.description,
      category: blueprint.category,
      tags: blueprint.tags,
      language: blueprint.language,
      country: blueprint.country,
      authorId,
      authorName,
      isOfficial: true,
      status: "draft",
      type: blueprint.type,
      sourceTemplateId: blueprint.id,
      sourceTemplateType: blueprint.type,
      templateContent: templateContentRecord,
      version: nextVersion,
      latestVersionId: versionId,
      aiEnrichmentStatus: "done",
      publishedAt: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      rejectionReason: undefined,
      officialGenerationMeta,
    });

    await templateRepo.update({
      id: existingTemplate.id,
      data: updateData,
    });

    return {
      stored: true,
      templateId: existingTemplate.id,
    };
  }

  const createData = toMarketplaceTemplateData({
    title: blueprint.title,
    shortDescription: blueprint.shortDescription,
    description: blueprint.description,
    type: blueprint.type,
    sourceTemplateId: blueprint.id,
    sourceTemplateType: blueprint.type,
    authorId,
    authorName,
    isOfficial: true,
    isFeatured: false,
    status: "draft",
    templateContent: templateContentRecord,
    previewImages: [],
    tags: blueprint.tags,
    category: blueprint.category,
    language: blueprint.language,
    country: blueprint.country,
    ratingAverage: 0,
    ratingCount: 0,
    downloadCount: 0,
    version: 1,
    aiEnrichmentStatus: "done",
    officialGenerationMeta,
  });

  const templateId = await templateRepo.create({ data: createData });

  const versionData = toMarketplaceTemplateVersionData({
    marketplaceTemplateId: templateId,
    version: 1,
    type: blueprint.type,
    title: blueprint.title,
    templateContent: templateContentRecord,
    sourceTemplateId: blueprint.id,
    sourceTemplateType: blueprint.type,
    createdBy: authorId,
    publishedAt: now,
    changelog: "Official template pack initial generation",
  });
  const versionId = await versionRepo.create({ data: versionData });

  await templateRepo.update({
    id: templateId,
    data: {
      latestVersionId: versionId,
    },
  });

  return {
    stored: true,
    templateId,
  };
}
