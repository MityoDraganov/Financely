import z from "zod";
import { baseEntitySchema } from "./base";

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
