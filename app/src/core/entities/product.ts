import z from "zod";
import { baseEntitySchema } from "./base";

export const productPublicQrSchema = z.object({
  assetUrl: z.string().url().optional(),
  payloadMode: z.enum(["hybrid", "text-only"]).default("hybrid"),
  payloadHash: z.string().optional(),
  packetVersion: z.number().int().min(1).default(1),
  generatedAt: z.string().optional(),
  storagePath: z.string().optional(),
  version: z.number().int().min(1).default(1),
});

const productPublicListingCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  image: z.string().url().optional(),
  category: z.string().optional(),
  canonicalPath: z.string(),
  canonicalUrl: z.string().url(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const productPublicDetailSnapshotSchema = z.object({
  fields: z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    currency: z.string(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string().url()).optional(),
    taxRate: z.number().optional(),
    weight: z.number().optional(),
    dimensions: z.object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      unit: z.enum(["cm", "in", "m"]).default("cm"),
    }).optional(),
  }),
  metafields: z.array(
    z.object({
      definitionId: z.string(),
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
      value: z.unknown(),
      displayValue: z.string(),
      dateDisplayMode: z.enum(["numeric", "localized"]).optional(),
    }),
  ).default([]),
});

export const productPublicPageSchema = z.object({
  slug: z.string().optional(),
  slugCanonical: z.string().optional(),
  slugAliases: z.array(z.string()).default([]),
  slugLookup: z.array(z.string()).default([]),
  orgSlugCanonical: z.string().optional(),
  collectionSlug: z.string().optional(),
  collectionLabel: z.string().optional(),
  state: z.enum(["published", "unavailable"]).default("unavailable"),
  canonicalPath: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  payloadHash: z.string().optional(),
  listingCard: productPublicListingCardSchema.optional(),
  detailSnapshot: productPublicDetailSnapshotSchema.optional(),
  version: z.number().int().min(1).default(1),
  lastSyncRequestedAt: z.string().optional(),
  lastPublishedAt: z.string().optional(),
  lastUnavailableAt: z.string().optional(),
  qr: productPublicQrSchema.optional(),
});

export const productDataSchema = z.object({
  // Organization ID for multi-tenancy
  organizationId: z.string().min(1, "Organization ID is required"),

  // Basic product information
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  
  // Pricing
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.string().min(1, "Currency is required"),
  
  // Product identification
  sku: z.string().optional(),
  barcode: z.string().optional(),
  
  // Inventory management
  stockQuantity: z.number().int().min(0).optional(),
  trackInventory: z.boolean().default(false),
  lowStockThreshold: z.number().int().min(0).optional(),
  
  // Images
  images: z.array(z.string().url()).default([]),
  
  // Product categorization
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  // Additional metadata
  weight: z.number().min(0).optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    unit: z.enum(["cm", "in", "m"]).default("cm"),
  }).optional(),
  
  // Status
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  
  // Tax information
  taxRate: z.number().min(0).max(100).optional(),
  
  // Cost (for profit calculation)
  cost: z.number().min(0).optional(),

  // Public product page metadata
  publicPage: productPublicPageSchema.optional(),
});

export type ProductData = z.infer<typeof productDataSchema>;
export const productSchema = baseEntitySchema.merge(productDataSchema);
export type Product = z.infer<typeof productSchema>;

/**
 * Helper type for creating products with partial data.
 * Omits server-managed fields like id, createdAt, updatedAt.
 */
export type CreateProductInput = Omit<ProductData, "status"> & {
  status?: ProductData["status"];
};
