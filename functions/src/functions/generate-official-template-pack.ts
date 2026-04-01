import { randomUUID } from "node:crypto";
import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminAuth } from "../utils/admin-auth-utils";
import { getOfficialTemplateBlueprints } from "../genkit/official-template-blueprints";
import { genkitGeminiApiKeySecret, getOfficialTemplateGenkit } from "../genkit/runtime";
import { buildOfficialTemplateFlows } from "../genkit/flows";
import { getInvoiceStyleProfileByBlueprintId } from "../genkit/invoice-style-profiles";
import {
  emailGenerationSchema,
  invoiceGenerationSchema,
  officialTemplatePackCallableResultSchema,
  officialTemplatePackInputSchema,
  toCanonicalEmailTemplateData,
  toCanonicalInvoiceTemplateData,
} from "../genkit/schemas";
import {
  getAdminDisplayName,
  upsertOfficialTemplateDraft,
} from "../genkit/official-template-pack-service";
import {
  evaluateEmailTemplateQa,
  evaluateInvoiceTemplateQa,
} from "../genkit/qa";

const QA_PASS_SCORE = 85;
const OFFICIAL_ORG_PLACEHOLDER = "[Financely Official Template]";

function parseInput(data: unknown) {
  const parsed = officialTemplatePackInputSchema.safeParse(data || {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.message);
  }
  return parsed.data;
}

export const generateOfficialTemplatePack = onCall(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [genkitGeminiApiKeySecret],
  },
  async (request) => {
    const runId = randomUUID();
    try {
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "marketplace.moderate",
      });
      const input = parseInput(request.data);

      const selectedBlueprints = getOfficialTemplateBlueprints(input.blueprintIds);
      if (selectedBlueprints.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "No valid blueprint IDs were provided.",
        );
      }

      const apiKey = genkitGeminiApiKeySecret.value();
      const ai = getOfficialTemplateGenkit(apiKey);
      const flows = buildOfficialTemplateFlows(ai);
      const flowOutput = await flows.generateOfficialTemplatePackFlow({
        blueprints: selectedBlueprints,
      });

      const blueprintMap = new Map(selectedBlueprints.map((blueprint) => [blueprint.id, blueprint]));
      const authorName = await getAdminDisplayName(adminAuth.userId);

      const results: Array<{
        blueprintId: string;
        type: "invoice" | "email";
        language: "en" | "bg";
        status: "ok" | "failed";
        qaScore?: number;
        checks?: Record<string, boolean>;
        qaWarnings?: string[];
        styleProfileId?: string;
        errors: string[];
        templateId?: string;
      }> = [];

      for (const result of flowOutput.results) {
        const blueprint = blueprintMap.get(result.blueprintId);
        if (!blueprint) {
          results.push({
            blueprintId: result.blueprintId,
            type: result.type,
            language: result.language,
            status: "failed",
            errors: ["Blueprint not found for flow result"],
          });
          continue;
        }

        if (result.status === "failed" || !result.templateContent) {
          results.push({
            blueprintId: result.blueprintId,
            type: blueprint.type,
            language: blueprint.language,
            status: "failed",
            errors: result.errors.length > 0 ? result.errors : ["Flow generation failed"],
          });
          continue;
        }

        try {
          if (blueprint.type === "invoice") {
            const generatedAt = new Date().toISOString();
            const styleProfile = getInvoiceStyleProfileByBlueprintId(blueprint.id);
            const stageA = invoiceGenerationSchema.parse(result.templateContent);
            const canonicalTemplate = toCanonicalInvoiceTemplateData(stageA, OFFICIAL_ORG_PLACEHOLDER);
            const qa = evaluateInvoiceTemplateQa(
              canonicalTemplate,
              blueprint.language,
              styleProfile?.id,
            );
            const hardPass = qa.errors.length === 0;
            const upsertResult = await upsertOfficialTemplateDraft({
              blueprint,
              templateContent: canonicalTemplate,
              authorId: adminAuth.userId,
              authorName,
              overwriteExisting: input.overwriteExisting,
              dryRun: input.dryRun,
              officialGenerationMeta: {
                runId,
                qaScore: qa.score,
                qaChecks: qa.checks,
                qaWarnings: qa.warnings,
                hardPass,
                styleProfileId: styleProfile?.id,
                generatedAt,
              },
            });

            const qaPassed = qa.score >= QA_PASS_SCORE && hardPass;
            const status = qaPassed ? "ok" : "failed";
            const errors = [...qa.errors];
            if (upsertResult.skippedReason) {
              errors.push(upsertResult.skippedReason);
            }

            results.push({
              blueprintId: blueprint.id,
              type: blueprint.type,
              language: blueprint.language,
              status,
              qaScore: qa.score,
              checks: qa.checks,
              qaWarnings: qa.warnings,
              styleProfileId: styleProfile?.id,
              errors,
              templateId: upsertResult.templateId,
            });
          } else {
            const generatedAt = new Date().toISOString();
            const stageA = emailGenerationSchema.parse(result.templateContent);
            const canonicalTemplate = toCanonicalEmailTemplateData(stageA, OFFICIAL_ORG_PLACEHOLDER);
            const qa = evaluateEmailTemplateQa(canonicalTemplate, blueprint.language);
            const hardPass = qa.errors.length === 0;
            const upsertResult = await upsertOfficialTemplateDraft({
              blueprint,
              templateContent: canonicalTemplate,
              authorId: adminAuth.userId,
              authorName,
              overwriteExisting: input.overwriteExisting,
              dryRun: input.dryRun,
              officialGenerationMeta: {
                runId,
                qaScore: qa.score,
                qaChecks: qa.checks,
                qaWarnings: qa.warnings,
                hardPass,
                generatedAt,
              },
            });

            const qaPassed = qa.score >= QA_PASS_SCORE && hardPass;
            const status = qaPassed ? "ok" : "failed";
            const errors = [...qa.errors];
            if (upsertResult.skippedReason) {
              errors.push(upsertResult.skippedReason);
            }

            results.push({
              blueprintId: blueprint.id,
              type: blueprint.type,
              language: blueprint.language,
              status,
              qaScore: qa.score,
              checks: qa.checks,
              qaWarnings: qa.warnings,
              errors,
              templateId: upsertResult.templateId,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            blueprintId: blueprint.id,
            type: blueprint.type,
            language: blueprint.language,
            status: "failed",
            errors: [message],
          });
        }
      }

      const generated = results.filter(
        (entry) => typeof entry.qaScore === "number" || typeof entry.templateId === "string",
      ).length;
      const qaPassed = results.filter(
        (entry) =>
          typeof entry.qaScore === "number" &&
          entry.qaScore >= QA_PASS_SCORE &&
          entry.errors.length === 0,
      ).length;
      const failed = results.filter((entry) => entry.status === "failed").length;
      const stored = results.filter((entry) => typeof entry.templateId === "string").length;

      const response = officialTemplatePackCallableResultSchema.parse({
        runId,
        summary: {
          requested: selectedBlueprints.length,
          generated,
          qaPassed,
          failed,
          stored,
        },
        results,
      });

      logger.info("Official template pack generation completed", {
        runId,
        requested: selectedBlueprints.length,
        generated,
        qaPassed,
        failed,
        stored,
        dryRun: input.dryRun,
        adminUserId: adminAuth.userId,
      });

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Official template pack generation failed", {
        runId,
        error: message,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", message);
    }
  },
);
