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
  // Manual file editing support - stores files as key-value pairs (path -> content)
  files: z.record(z.string(), z.string()).optional(), // e.g., { "index.html": "...", "styles.css": "...", "script.js": "..." }
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
  // Page management
  pages: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        context: z.string().optional(),
        type: z.enum(["standard", "blog", "contact"]).default("standard"),
        order: z.number().int().default(0),
        contentEntries: z
          .array(
            z.object({
              id: z.string(),
              title: z.string().min(1),
              summary: z.string().optional(),
              link: z.string().url().optional(),
              image: z.string().url().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  // Version history - stores previous versions of the site
  versions: z.array(
    z.object({
      version: z.number().int(),
      html: z.string(),
      files: z.record(z.string(), z.string()).optional(), // Store files for version history
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
  // Chat conversations - stores AI chat history
  conversations: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().optional(), // Auto-generated from first message or user-defined
        messages: z.array(
          z.object({
            id: z.string(),
            role: z.enum(["user", "assistant"]),
            content: z.string(),
            attachments: z.array(z.string().url()).optional(),
            timestamp: z.string(),
          })
        ),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    )
    .default([]),
  // Chat request - temporary field for async processing
  chatRequest: z
    .object({
      id: z.string(),
      message: z.string(),
      attachments: z.array(z.string().url()).optional(),
      conversationHistory: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
          attachments: z.array(z.string().url()).optional(),
        })
      ).optional(),
      conversationId: z.string().nullable().optional(),
      status: z.enum(["pending", "processing", "completed"]),
      createdAt: z.string(),
    })
    .nullable()
    .optional(),
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
    | "files"
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

