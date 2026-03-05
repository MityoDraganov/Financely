import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAuth, verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { getMarketplaceTemplateVersionRepository } from "../repositories/marketplace-template-version-repository";
import { templateSanitizationService } from "../services/template-sanitization-service";
import { loggerService } from "../services/logger-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import type { Template } from "../core/entities/template";
import type { EmailTemplate } from "../core/entities/email-template";

interface PublishMarketplaceTemplateVersionInput {
  marketplaceTemplateId: string;
  changelog?: string;
}

interface PublishMarketplaceTemplateVersionResponse {
  versionId: string;
  version: number;
  message: string;
}

/**
 * Publish a new version for an existing marketplace template.
 * Requires contributor status and owner/admin membership in the listing organization.
 */
export const publishMarketplaceTemplateVersion = onCall<
  PublishMarketplaceTemplateVersionInput,
  Promise<PublishMarketplaceTemplateVersionResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const userId = await verifyAuth(request);
      const {
        marketplaceTemplateId,
        changelog,
      } = request.data;

      if (!marketplaceTemplateId) {
        throw new HttpsError("invalid-argument", "Marketplace template ID is required");
      }
      const db = getFirestore();
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const isContributor = userData?.isMarketplaceContributor === true;
      if (!isContributor) {
        throw new HttpsError(
          "permission-denied",
          "You must be registered as a contributor to publish template versions"
        );
      }

      const databaseService = getDatabaseService();
      const marketplaceTemplateRepo = getMarketplaceTemplateRepository(databaseService);
      const marketplaceTemplateVersionRepo = getMarketplaceTemplateVersionRepository(databaseService);

      const marketplaceTemplate = await marketplaceTemplateRepo.get({ id: marketplaceTemplateId });
      if (!marketplaceTemplate) {
        throw new HttpsError("not-found", "Marketplace template not found");
      }

      const templateOrganizationId =
        marketplaceTemplate.organizationId || marketplaceTemplate.sourceOrgId;
      if (!templateOrganizationId) {
        throw new HttpsError(
          "failed-precondition",
          "Marketplace template is missing organization ownership information"
        );
      }

      await verifyAuthAndOrgMembership(request, templateOrganizationId, {
        requireOwnerOrAdmin: true,
      });

      const sourceTemplateId = marketplaceTemplate.sourceTemplateId;
      const sourceTemplateType = marketplaceTemplate.sourceTemplateType || marketplaceTemplate.type;
      const sourceOrgId = marketplaceTemplate.sourceOrgId;

      if (!sourceTemplateId || !sourceOrgId) {
        throw new HttpsError(
          "failed-precondition",
          "This listing has no locked source template. Create a new listing to enable version publishing."
        );
      }

      if (sourceTemplateType !== "invoice" && sourceTemplateType !== "email") {
        throw new HttpsError("failed-precondition", "Listing has an invalid source template type");
      }

      if (marketplaceTemplate.type !== sourceTemplateType) {
        throw new HttpsError(
          "failed-precondition",
          `Listing type is ${marketplaceTemplate.type}, but source template type is ${sourceTemplateType}`
        );
      }

      let sanitizedContent: Record<string, unknown>;
      if (sourceTemplateType === "invoice") {
        const sourceTemplate = await realtimeDatabaseService.get<Template>("templates", sourceTemplateId);
        if (!sourceTemplate) {
          throw new HttpsError("not-found", "Source template not found");
        }
        if (sourceTemplate.orgId !== sourceOrgId) {
          throw new HttpsError(
            "permission-denied",
            "Locked source template is no longer available in its original organization"
          );
        }
        sanitizedContent = templateSanitizationService.sanitizeInvoiceTemplate(sourceTemplate);
      } else {
        const sourceEmailTemplate = await realtimeDatabaseService.get<EmailTemplate>(
          "emailTemplates",
          sourceTemplateId
        );
        if (!sourceEmailTemplate) {
          throw new HttpsError("not-found", "Source email template not found");
        }
        if (sourceEmailTemplate.orgId !== sourceOrgId) {
          throw new HttpsError(
            "permission-denied",
            "Locked source email template is no longer available in its original organization"
          );
        }
        sanitizedContent = templateSanitizationService.sanitizeEmailTemplate(sourceEmailTemplate);
      }

      const existingVersions = await marketplaceTemplateVersionRepo.getAll({
        queryConstraints: [{ field: "marketplaceTemplateId", operator: "==", value: marketplaceTemplateId }],
        orderBy: { field: "version", direction: "desc" },
      });

      const highestRecordedVersion = existingVersions.length > 0 ? existingVersions[0].version : 0;
      const nextVersion = Math.max(marketplaceTemplate.version || 1, highestRecordedVersion) + 1;
      const now = new Date().toISOString();

      const versionId = await marketplaceTemplateVersionRepo.create({
        data: {
          marketplaceTemplateId,
          version: nextVersion,
          type: sourceTemplateType,
          title: marketplaceTemplate.title,
          templateContent: sanitizedContent,
          changelog: changelog?.trim() || undefined,
          sourceTemplateId,
          sourceTemplateType,
          createdBy: userId,
          publishedAt: now,
        },
      });

      await marketplaceTemplateRepo.update({
        id: marketplaceTemplateId,
        data: {
          templateContent: sanitizedContent,
          organizationId: templateOrganizationId,
          version: nextVersion,
          latestVersionId: versionId,
          sourceTemplateId,
          sourceTemplateType,
          sourceOrgId,
          status: "published",
          publishedAt: now,
          aiEnrichmentStatus: "pending",
        },
      });

      loggerService.info("Marketplace template version published", {
        marketplaceTemplateId,
        versionId,
        version: nextVersion,
        sourceTemplateId,
        sourceTemplateType,
        organizationId: templateOrganizationId,
        sourceOrgId,
        userId,
      });

      return {
        versionId,
        version: nextVersion,
        message: `Version ${nextVersion} published successfully.`,
      };
    } catch (error) {
      loggerService.error("Error publishing marketplace template version", {
        marketplaceTemplateId: request.data?.marketplaceTemplateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to publish marketplace template version");
    }
  }
);
