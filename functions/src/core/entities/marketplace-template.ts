import z from "zod";
import { baseEntitySchema } from "./base";

export const marketplaceTemplateDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  type: z.enum(["invoice", "email"]),
  organizationId: z.string().optional(),
  sourceTemplateId: z.string().optional(),
  sourceTemplateType: z.enum(["invoice", "email"]).optional(),
  sourceOrgId: z.string().optional(),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  isOfficial: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  status: z.enum(["draft", "pending", "approved", "published", "rejected", "unpublished"]).default("draft"),
  // Template content snapshot - can be either invoice or email template data
  // Stored as a record to allow flexible template data structures
  // Type safety is enforced at runtime when importing based on the 'type' field
  templateContent: z.record(z.string(), z.unknown()),
  previewImages: z.array(z.string().url()).default([]),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  language: z.string().optional(),
  country: z.string().optional(),
  ratingAverage: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  downloadCount: z.number().int().min(0).default(0),
  version: z.number().int().min(1).default(1),
  latestVersionId: z.string().optional(),
  publishedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  aiEnrichmentStatus: z.enum(["pending", "processing", "done", "failed"]).default("pending"),
});

export type MarketplaceTemplateData = z.infer<typeof marketplaceTemplateDataSchema>;

export const marketplaceTemplateSchema = baseEntitySchema.merge(marketplaceTemplateDataSchema);
export type MarketplaceTemplate = z.infer<typeof marketplaceTemplateSchema>;

export const marketplaceTemplateVersionDataSchema = z.object({
  marketplaceTemplateId: z.string().min(1),
  version: z.number().int().min(1),
  type: z.enum(["invoice", "email"]),
  title: z.string().min(1),
  templateContent: z.record(z.string(), z.unknown()),
  changelog: z.string().optional(),
  sourceTemplateId: z.string().optional(),
  sourceTemplateType: z.enum(["invoice", "email"]).optional(),
  createdBy: z.string().optional(),
  publishedAt: z.string().min(1),
});

export type MarketplaceTemplateVersionData = z.infer<typeof marketplaceTemplateVersionDataSchema>;
export const marketplaceTemplateVersionSchema = baseEntitySchema.merge(marketplaceTemplateVersionDataSchema);
export type MarketplaceTemplateVersion = z.infer<typeof marketplaceTemplateVersionSchema>;
