import z from "zod";
import { baseEntitySchema } from "./base";

export const emailTemplateCompatModeSchema = z.enum(["legacy_v1", "canonical_v1"]);

export const emailTemplateRequirementLoopSchema = z.object({
  path: z.string().min(1),
  alias: z.string().min(1),
  rowFields: z.array(z.string().min(1)).default([]),
  emptyBehavior: z.enum(["hide", "row"]).default("hide"),
});

export const emailTemplateRequirementsSchema = z.object({
  version: z.literal("v1").default("v1"),
  compatMode: emailTemplateCompatModeSchema.default("canonical_v1"),
  entityTypes: z.array(z.string().min(1)).default([]),
  scalarPaths: z.array(z.string().min(1)).default([]),
  loops: z.array(emailTemplateRequirementLoopSchema).default([]),
  strict: z.boolean().default(true),
  extractedAt: z.string().optional(),
});

export const emailTemplateRequirementsMetaSchema = z.object({
  lastEvaluatedAt: z.string().optional(),
  lastCompatibilitySample: z.record(z.string(), z.any()).optional(),
});

export const emailTemplateDataSchema = z.object({
  orgId: z.string().min(1),
  brandId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  key: z.string().optional(),
  subject: z.string().min(1),
  preheader: z.string().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  version: z.number().int().min(1).default(1),
  isSystemDefault: z.boolean().default(false),
  isLocked: z.boolean().default(false),
  allowedContexts: z.array(z.string()).default([]),
  htmlContent: z.string().default(""),
  blocks: z.array(z.any()).default([]),
  designTokens: z.record(z.string(), z.any()).default({}),
  placeholders: z.array(z.any()).default([]),
  compatMode: emailTemplateCompatModeSchema.optional(),
  requirements: emailTemplateRequirementsSchema.optional(),
  requirementsMeta: emailTemplateRequirementsMetaSchema.optional(),
  normalizationVersion: z.literal("email_vm_v1").optional(),
  sections: z.object({
    header: z.array(z.string()).default([]),
    body: z.array(z.string()).default([]),
    footer: z.array(z.string()).default([]),
  }).optional(),
  // Marketplace template ID if this template was imported from marketplace
  marketplaceTemplateId: z.string().optional(),
});

export type EmailTemplateData = z.infer<typeof emailTemplateDataSchema>;

export const emailTemplateSchema = baseEntitySchema.merge(emailTemplateDataSchema);
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
