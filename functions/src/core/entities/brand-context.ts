import z from "zod";

/**
 * Brand Context Entity
 * 
 * Represents all organization-level branding data used throughout the platform
 * by invoices, proposals, AI builder, widgets, site builder, analytics, etc.
 */
export const brandContextSchema = z.object({
  // Organization identification
  organizationId: z.string().min(1),
  
  // Basic brand information
  brandName: z.string().min(1),
  description: z.string().optional(),
  
  // Visual branding
  brandColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  logoUrl: z.string().url().optional(),
  customFavicon: z.string().url().optional(),
  brandImages: z.array(z.string().url()).default([]),
  
  // Brand personality
  tone: z.string().default("professional"),
  
  // Language and localization
  defaultLanguage: z.string().default("en"),
  defaultCurrency: z.string().default("USD"),
  defaultTimezone: z.string().default("UTC"),
  
  // Organization contact information
  website: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  
  // Products for context (used in AI generation, proposals, etc.)
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    currency: z.string(),
    category: z.string().optional(),
    images: z.array(z.string().url()).default([]),
  })).default([]),
  
  // Widget configuration
  widgets: z.object({
    enabled: z.boolean().default(false),
    contactForm: z.object({
      enabled: z.boolean().default(false),
      title: z.string().default("Contact Us"),
      description: z.string().optional(),
      position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
      displayMode: z.enum(["floating", "inline"]).default("floating"),
      submitButtonText: z.string().default("Send Message"),
      successMessage: z.string().default("Thank you! We'll get back to you soon."),
    }).optional(),
    invoiceRequest: z.object({
      enabled: z.boolean().default(false),
      title: z.string().default("Request Invoice"),
      description: z.string().optional(),
      position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
      submitButtonText: z.string().default("Request Invoice"),
      successMessage: z.string().default("Invoice request submitted successfully!"),
    }).optional(),
    quoteRequest: z.object({
      enabled: z.boolean().default(false),
      title: z.string().default("Request Quote"),
      description: z.string().optional(),
      position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
      submitButtonText: z.string().default("Request Quote"),
      successMessage: z.string().default("Quote request submitted successfully!"),
    }).optional(),
  }).optional(),
  
  // Additional branding metadata
  branding: z.object({
    companyName: z.string().optional(),
    customDomain: z.string().optional(),
    emailFromName: z.string().optional(),
    emailFromAddress: z.string().email().optional(),
    footerText: z.string().optional(),
  }).optional(),
  
  // Compliance and regional settings
  country: z.string().optional(), // ISO country code
  region: z.enum(["US", "EU", "CA", "AU", "UK"]).optional(),
  
  // Invoice/document defaults
  invoicePrefix: z.string().default("INV"),
  invoiceNumberStart: z.number().int().min(1).default(1),
  
  // Cache metadata (internal use)
  cachedAt: z.string().optional(),
  version: z.number().int().default(1), // Increment on invalidation
});

export type BrandContext = z.infer<typeof brandContextSchema>;

/**
 * Brand Context for AI generation (simplified format used by Gemini service)
 */
export const brandContextForAISchema = z.object({
  brandName: z.string(),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  logoUrl: z.string().url().optional(),
  tone: z.string(),
  description: z.string().optional(),
  brandImages: z.array(z.string().url()).default([]),
  context: z.string().optional(),
  contextImages: z.array(z.string().url()).default([]),
  products: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    currency: z.string(),
    category: z.string().optional(),
    images: z.array(z.string().url()).default([]),
  })).default([]),
  widgets: z.object({
    enabled: z.boolean(),
    contactForm: z.object({
      enabled: z.boolean(),
      title: z.string(),
      description: z.string().optional(),
      position: z.string(),
      displayMode: z.string().optional(),
    }).optional(),
    invoiceRequest: z.object({
      enabled: z.boolean(),
      title: z.string(),
      description: z.string().optional(),
      position: z.string(),
      displayMode: z.string().optional(),
    }).optional(),
    quoteRequest: z.object({
      enabled: z.boolean(),
      title: z.string(),
      description: z.string().optional(),
      position: z.string(),
      displayMode: z.string().optional(),
    }).optional(),
  }).optional(),
  pageTitle: z.string().optional(),
  pagePurpose: z.string().optional(),
  pageSlug: z.string().optional(),
  pageType: z.string().optional(),
  pageContentEntries: z.array(z.object({
    title: z.string(),
    summary: z.string().optional(),
    link: z.string().url().optional(),
    image: z.string().url().optional(),
    description: z.string().optional(),
  })).optional(),
  availablePages: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    href: z.string(),
  })).optional(),
});

export type BrandContextForAI = z.infer<typeof brandContextForAISchema>;

