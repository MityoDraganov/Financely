import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAuth } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { templateSanitizationService } from "../services/template-sanitization-service";
import { loggerService } from "../services/logger-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import type { Template } from "../core/entities/template";
import type { EmailTemplate } from "../core/entities/email-template";

interface SubmitMarketplaceTemplateInput {
  sourceTemplateId: string;
  sourceTemplateType: "invoice" | "email";
  orgId: string; // Organization ID to verify template ownership
  title: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  tags?: string[];
  language?: string;
  country?: string;
  previewImages?: string[];
}

interface SubmitMarketplaceTemplateResponse {
  submissionId: string;
  status: "published";
  message: string;
}

/**
 * Submit a template to the marketplace
 * Requires user to be an approved contributor
 */
export const submitMarketplaceTemplate = onCall<
  SubmitMarketplaceTemplateInput,
  Promise<SubmitMarketplaceTemplateResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      const userId = await verifyAuth(request);

      const {
        sourceTemplateId,
        sourceTemplateType,
        orgId,
        title,
        description,
        shortDescription,
        category,
        tags = [],
        language,
        country,
        previewImages = [],
      } = request.data;

      if (!sourceTemplateId) {
        throw new HttpsError(
          "invalid-argument",
          "Source template ID is required"
        );
      }

      if (!orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID is required"
        );
      }

      if (!title) {
        throw new HttpsError("invalid-argument", "Title is required");
      }

      // Check if user is an approved contributor
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
          "You must be registered as a contributor to submit templates"
        );
      }

      const databaseService = getDatabaseService();
      const marketplaceTemplateRepo = getMarketplaceTemplateRepository(
        databaseService
      );

      // Get the source template from Realtime Database (templates are stored in RTDB, not Firestore)
      let templateContent: any;
      let authorName = userData?.name || userData?.email || "Unknown";

      if (sourceTemplateType === "invoice") {
        // Templates are stored in Realtime Database
        const template = await realtimeDatabaseService.get<Template>(
          "templates",
          sourceTemplateId
        );

        if (!template) {
          loggerService.error("Template not found in Realtime Database", {
            templateId: sourceTemplateId,
            orgId,
            userId,
          });
          throw new HttpsError("not-found", "Source template not found");
        }

        // Verify template belongs to the organization
        if (template.orgId !== orgId) {
          loggerService.warn("Template orgId mismatch", {
            templateId: sourceTemplateId,
            templateOrgId: template.orgId,
            requestedOrgId: orgId,
            userId,
          });
          throw new HttpsError(
            "permission-denied",
            "Template does not belong to this organization"
          );
        }

        // Sanitize template
        templateContent = templateSanitizationService.sanitizeInvoiceTemplate(
          template
        );
      } else {
        // Email templates are also stored in Realtime Database
        const template = await realtimeDatabaseService.get<EmailTemplate>(
          "emailTemplates",
          sourceTemplateId
        );

        if (!template) {
          loggerService.error("Email template not found in Realtime Database", {
            templateId: sourceTemplateId,
            orgId,
            userId,
          });
          throw new HttpsError("not-found", "Source email template not found");
        }

        // Verify template belongs to the organization
        if (template.orgId !== orgId) {
          loggerService.warn("Email template orgId mismatch", {
            templateId: sourceTemplateId,
            templateOrgId: template.orgId,
            requestedOrgId: orgId,
            userId,
          });
          throw new HttpsError(
            "permission-denied",
            "Email template does not belong to this organization"
          );
        }

        // Sanitize template
        templateContent =
          templateSanitizationService.sanitizeEmailTemplate(template);
      }

      // Validation disabled - templates can have any structure
      // No required placeholders are enforced

      // Create marketplace template - publish directly (no approval needed)
      const now = new Date().toISOString();
      const submissionId = await marketplaceTemplateRepo.create({
        data: {
          title,
          description,
          shortDescription,
          type: sourceTemplateType,
          authorId: userId,
          authorName,
          isOfficial: false,
          isFeatured: false,
          status: "published",
          templateContent,
          previewImages,
          tags,
          category,
          language,
          country,
          ratingAverage: 0,
          ratingCount: 0,
          downloadCount: 0,
          version: 1,
          publishedAt: now,
        },
      });

      loggerService.info("Marketplace template published", {
        submissionId,
        userId,
        title,
        type: sourceTemplateType,
      });

      return {
        submissionId,
        status: "published",
        message: "Template published successfully to the marketplace.",
      };
    } catch (error) {
      loggerService.error("Error submitting marketplace template", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to submit marketplace template"
      );
    }
  }
);
