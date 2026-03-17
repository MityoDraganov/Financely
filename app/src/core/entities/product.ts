import z from "zod";
import { baseEntitySchema } from "./base";

export const productPublicQrSchema = z.object({
  assetUrl: z.string().url().optional(),
  payloadMode: z.enum(["hybrid", "text-only"]).default("hybrid"),
  payloadHash: z.string().optional(),
  generatedAt: z.string().optional(),
  storagePath: z.string().optional(),
  version: z.number().int().min(1).default(1),
});

export const productPublicPageSchema = z.object({
  slug: z.string().optional(),
  slugAliases: z.array(z.string()).default([]),
  state: z.enum(["published", "unavailable"]).default("unavailable"),
  canonicalPath: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  payloadHash: z.string().optional(),
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
