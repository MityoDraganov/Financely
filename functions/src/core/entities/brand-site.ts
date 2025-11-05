import z from "zod";
import { baseEntitySchema } from "./base";

export const brandSiteStatusSchema = z.enum([
  "pending",
  "generating",
  "deploying",
  "success",
  "failed",
]);

export type BrandSiteStatus = z.infer<typeof brandSiteStatusSchema>;

export const brandSiteDataSchema = z.object({
  organizationId: z.string().min(1),
  brandName: z.string().min(1),
  brandColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  logoUrl: z.string().url().optional(),
  tone: z.string().default("professional"),
  html: z.string().optional(),
  metadata: z
    .object({
      generatedAt: z.string().optional(),
      model: z.string().optional(),
      version: z.number().int().default(1),
      regenerateSectionType: z.enum(["hero", "about", "features", "contact"]).optional(),
    })
    .optional(),
  status: brandSiteStatusSchema.default("pending"),
  subdomain: z.string().optional(),
  customDomain: z.string().optional(),
  deployedUrl: z.string().optional(),
  error: z.string().optional(),
  lastRegeneratedAt: z.string().optional(),
  // AI generation context (temporary, not saved to brand)
  context: z.string().optional(),
  contextImages: z.array(z.string().url()).default([]),
  // Version history - stores previous versions of the site
  versions: z.array(
    z.object({
      version: z.number().int(),
      html: z.string(),
      deployedUrl: z.string().optional(),
      previewUrl: z.string().optional(), // Preview URL for viewing without making live
      metadata: z
        .object({
          generatedAt: z.string().optional(),
          model: z.string().optional(),
          regenerateSectionType: z.enum(["hero", "about", "features", "contact"]).optional(),
        })
        .optional(),
      createdAt: z.string(),
      description: z.string().optional(),
    })
  ).default([]),
});

export type BrandSiteData = z.infer<typeof brandSiteDataSchema>;

export const brandSiteSchema = baseEntitySchema.merge(brandSiteDataSchema);
export type BrandSite = z.infer<typeof brandSiteSchema>;

export type CreateBrandSiteInput = Pick<
  BrandSiteData,
  "organizationId" | "brandName" | "brandColors" | "logoUrl" | "tone"
>;

export type UpdateBrandSiteInput = Partial<
  Pick<
    BrandSiteData,
    | "html"
    | "status"
    | "subdomain"
    | "customDomain"
    | "deployedUrl"
    | "error"
    | "metadata"
    | "lastRegeneratedAt"
    | "context"
    | "contextImages"
  >
>;

