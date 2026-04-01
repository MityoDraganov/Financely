import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminAuth } from "../utils/admin-auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import {
  publishOfficialTemplatePackInputSchema,
  publishOfficialTemplatePackResultSchema,
  toMarketplaceTemplateData,
} from "../genkit/schemas";
import {
  parseCanonicalTemplateContent,
  parseMarketplaceTemplateEntityData,
} from "../genkit/official-template-pack-service";
import {
  evaluateEmailTemplateQa,
  evaluateInvoiceTemplateQa,
} from "../genkit/qa";
import type { TemplateData } from "../core/entities/template";
import type { EmailTemplateData } from "../core/entities/email-template";

const QA_PASS_SCORE = 85;

function parseInput(data: unknown) {
  const parsed = publishOfficialTemplatePackInputSchema.safeParse(data || {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  return parsed.data;
}

export const publishOfficialTemplatePack = onCall(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "marketplace.moderate",
      });
      const input = parseInput(request.data);

      const databaseService = getDatabaseService();
      const templateRepo = getMarketplaceTemplateRepository(databaseService);
      const now = new Date().toISOString();

      const details: Array<{
        templateId: string;
        status: "published" | "skipped" | "failed";
        reason?: string;
      }> = [];

      for (const templateId of input.templateIds) {
        try {
          const template = await templateRepo.get({ id: templateId });
          if (!template) {
            details.push({
              templateId,
              status: "failed",
              reason: "Marketplace template not found",
            });
            continue;
          }

          if (!template.isOfficial) {
            details.push({
              templateId,
              status: "skipped",
              reason: "Template is not marked as official",
            });
            continue;
          }

          if (template.status !== "draft") {
            details.push({
              templateId,
              status: "skipped",
              reason: `Template status must be draft, got: ${template.status}`,
            });
            continue;
          }

          const templateData = parseMarketplaceTemplateEntityData(template);
          const canonicalContent = parseCanonicalTemplateContent(
            template.type,
            templateData.templateContent,
          );

          if (input.requireQaPass) {
            let qa: ReturnType<typeof evaluateInvoiceTemplateQa>;
            if (template.type === "invoice") {
              qa = evaluateInvoiceTemplateQa(
                canonicalContent as TemplateData,
                template.language === "bg" ? "bg" : "en",
                template.officialGenerationMeta?.styleProfileId,
              );
            } else {
              qa = evaluateEmailTemplateQa(
                canonicalContent as EmailTemplateData,
                template.language === "bg" ? "bg" : "en",
              );
            }

            if (qa.score < QA_PASS_SCORE || qa.errors.length > 0) {
              details.push({
                templateId,
                status: "skipped",
                reason: `QA gate failed (score ${qa.score}): ${qa.errors.join("; ")}`,
              });
              continue;
            }
          }

          const updateData = toMarketplaceTemplateData({
            ...templateData,
            status: "published",
            publishedAt: now,
            approvedBy: adminAuth.userId,
            approvedAt: now,
            rejectionReason: undefined,
          });

          await templateRepo.update({
            id: templateId,
            data: updateData,
          });

          details.push({
            templateId,
            status: "published",
          });
        } catch (error) {
          details.push({
            templateId,
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const published = details.filter((item) => item.status === "published").length;
      const skipped = details.filter((item) => item.status === "skipped").length;
      const failed = details.filter((item) => item.status === "failed").length;

      const response = publishOfficialTemplatePackResultSchema.parse({
        published,
        skipped,
        failed,
        details,
      });

      logger.info("Official template pack publish completed", {
        published,
        skipped,
        failed,
        adminUserId: adminAuth.userId,
      });

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Official template pack publish failed", { error: message });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", message);
    }
  },
);
