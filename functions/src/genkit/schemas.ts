import z from "zod";
import {
  templateDataSchema,
  templateElementSchema,
  type TemplateData,
} from "../core/entities/template";
import {
  emailTemplateDataSchema,
  type EmailTemplateData,
} from "../core/entities/email-template";
import {
  marketplaceTemplateDataSchema,
  marketplaceTemplateVersionDataSchema,
  type MarketplaceTemplateData,
  type MarketplaceTemplateVersionData,
} from "../core/entities/marketplace-template";

export const officialTemplateTypeSchema = z.enum(["invoice", "email"]);
export type OfficialTemplateType = z.infer<typeof officialTemplateTypeSchema>;

export const officialTemplateLanguageSchema = z.enum(["en", "bg"]);
export type OfficialTemplateLanguage = z.infer<typeof officialTemplateLanguageSchema>;

export const officialTemplateStatusSchema = z.enum(["ok", "failed"]);

export const invoiceGenerationSchema = templateDataSchema.omit({
  orgId: true,
  status: true,
  marketplaceTemplateId: true,
}).extend({
  elements: z.array(templateElementSchema).min(1),
});
export type InvoiceGenerationData = z.infer<typeof invoiceGenerationSchema>;

export const emailGenerationSchema = emailTemplateDataSchema.omit({
  orgId: true,
  status: true,
  version: true,
  isSystemDefault: true,
  isLocked: true,
  marketplaceTemplateId: true,
});
export type EmailGenerationData = z.infer<typeof emailGenerationSchema>;

export const officialTemplateBlueprintSchema = z.object({
  id: z.string().min(1),
  type: officialTemplateTypeSchema,
  language: officialTemplateLanguageSchema,
  region: z.literal("EU"),
  archetype: z.string().min(1),
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  country: z.literal("EU"),
  style: z.string().min(1),
  customPrompt: z.string().optional(),
});
export type OfficialTemplateBlueprint = z.infer<typeof officialTemplateBlueprintSchema>;

export const officialTemplatePackInputSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  overwriteExisting: z.boolean().optional().default(true),
  blueprintIds: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.array(z.string().min(1)).optional(),
  ),
});
export type OfficialTemplatePackInput = z.infer<typeof officialTemplatePackInputSchema>;

export const publishOfficialTemplatePackInputSchema = z.object({
  templateIds: z.array(z.string().min(1)).min(1),
  requireQaPass: z.boolean().optional().default(true),
});
export type PublishOfficialTemplatePackInput = z.infer<typeof publishOfficialTemplatePackInputSchema>;

export const officialTemplatePackFlowInputSchema = z.object({
  blueprints: z.array(officialTemplateBlueprintSchema).min(1),
});
export type OfficialTemplatePackFlowInput = z.infer<typeof officialTemplatePackFlowInputSchema>;

export const generatedTemplateContentSchema = z.record(z.string(), z.unknown());

export const generatedTemplateFlowResultSchema = z.object({
  blueprintId: z.string().min(1),
  type: officialTemplateTypeSchema,
  language: officialTemplateLanguageSchema,
  status: officialTemplateStatusSchema,
  templateContent: generatedTemplateContentSchema.optional(),
  errors: z.array(z.string()).default([]),
});
export type GeneratedTemplateFlowResult = z.infer<typeof generatedTemplateFlowResultSchema>;

export const officialTemplatePackFlowOutputSchema = z.object({
  results: z.array(generatedTemplateFlowResultSchema),
});
export type OfficialTemplatePackFlowOutput = z.infer<typeof officialTemplatePackFlowOutputSchema>;

export const qaChecksSchema = z.record(z.string(), z.boolean());

export const officialTemplatePackCallableResultSchema = z.object({
  runId: z.string(),
  summary: z.object({
    requested: z.number().int().nonnegative(),
    generated: z.number().int().nonnegative(),
    qaPassed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    stored: z.number().int().nonnegative(),
  }),
  results: z.array(
    z.object({
      blueprintId: z.string().min(1),
      type: officialTemplateTypeSchema,
      language: officialTemplateLanguageSchema,
      status: officialTemplateStatusSchema,
      qaScore: z.number().int().min(0).max(100).optional(),
      checks: qaChecksSchema.optional(),
      errors: z.array(z.string()).default([]),
      templateId: z.string().optional(),
    }),
  ),
});
export type OfficialTemplatePackCallableResult = z.infer<typeof officialTemplatePackCallableResultSchema>;

export const publishOfficialTemplatePackResultSchema = z.object({
  published: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  details: z.array(
    z.object({
      templateId: z.string().min(1),
      status: z.enum(["published", "skipped", "failed"]),
      reason: z.string().optional(),
    }),
  ),
});
export type PublishOfficialTemplatePackResult = z.infer<typeof publishOfficialTemplatePackResultSchema>;

export function toCanonicalInvoiceTemplateData(
  data: InvoiceGenerationData,
  orgId: string,
): TemplateData {
  return templateDataSchema.parse({
    ...data,
    orgId,
    status: "draft",
  });
}

export function toCanonicalEmailTemplateData(
  data: EmailGenerationData,
  orgId: string,
): EmailTemplateData {
  return emailTemplateDataSchema.parse({
    ...data,
    orgId,
    status: "draft",
    version: 1,
    isSystemDefault: false,
    isLocked: false,
  });
}

export function toMarketplaceTemplateData(
  data: MarketplaceTemplateData,
): MarketplaceTemplateData {
  return marketplaceTemplateDataSchema.parse(data);
}

export function toMarketplaceTemplateVersionData(
  data: MarketplaceTemplateVersionData,
): MarketplaceTemplateVersionData {
  return marketplaceTemplateVersionDataSchema.parse(data);
}
