import z from "zod";
import { baseEntitySchema } from "./base";

export const consentDefaultSchema = z.enum(["denied", "granted"]);

export const bannerProviderSchema = z.enum([
  "custom",
  "cookiebot",
  "iubenda",
  "klaro",
]);

export const analyticsConfigDataSchema = z.object({
  enabled: z.boolean().default(false),
  // Individual provider toggles (can enable multiple)
  enableGA4: z.boolean().default(false),
  enablePlausible: z.boolean().default(false),
  enableUmami: z.boolean().default(false),
  enableClarity: z.boolean().default(false),
  // Provider configuration
  ga4MeasurementId: z.string().optional(),
  clarityProjectId: z.string().optional(),
  plausibleDomain: z.string().optional(),
  umamiScriptUrl: z.string().url().optional(),
  umamiWebsiteId: z.string().optional(),
  // Consent and banner settings
  consentDefault: consentDefaultSchema.default("denied"),
  bannerProvider: bannerProviderSchema.default("custom"),
  // Legacy fields (kept for backward compatibility, deprecated)
  strategy: z.enum(["gtm", "gtag_only", "plausible", "umami"]).optional(),
  // Metadata
  orgId: z.string().min(1),
  siteId: z.string().optional(),
  brandName: z.string().optional(),
  enableBigQueryServerLogs: z.boolean().default(false),
});

export const analyticsConfigSchema = baseEntitySchema.merge(
  analyticsConfigDataSchema,
);

export type ConsentDefault = z.infer<typeof consentDefaultSchema>;
export type BannerProvider = z.infer<typeof bannerProviderSchema>;
export type AnalyticsConfigData = z.infer<typeof analyticsConfigDataSchema>;
export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;

