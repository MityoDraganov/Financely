import z from "zod";
import { baseEntitySchema } from "./base";

export const analyticsStrategySchema = z.enum([
  "gtm",
  "gtag_only",
  "plausible",
  "umami",
]);

export const consentDefaultSchema = z.enum(["denied", "granted"]);

export const bannerProviderSchema = z.enum([
  "custom",
  "cookiebot",
  "iubenda",
  "klaro",
]);

export const analyticsConfigDataSchema = z.object({
  enabled: z.boolean().default(false),
  strategy: analyticsStrategySchema.default("gtag_only"),
  gtmContainerId: z.string().optional(),
  ga4MeasurementId: z.string().optional(),
  clarityProjectId: z.string().optional(),
  plausibleDomain: z.string().optional(),
  umamiScriptUrl: z.string().url().optional(),
  umamiWebsiteId: z.string().optional(),
  consentDefault: consentDefaultSchema.default("denied"),
  bannerProvider: bannerProviderSchema.default("custom"),
  orgId: z.string().min(1),
  siteId: z.string().optional(),
  brandName: z.string().optional(),
  enableClarity: z.boolean().default(false),
  enableBigQueryServerLogs: z.boolean().default(false),
});

export const analyticsConfigSchema = baseEntitySchema.merge(
  analyticsConfigDataSchema,
);

export type AnalyticsStrategy = z.infer<typeof analyticsStrategySchema>;
export type ConsentDefault = z.infer<typeof consentDefaultSchema>;
export type BannerProvider = z.infer<typeof bannerProviderSchema>;
export type AnalyticsConfigData = z.infer<typeof analyticsConfigDataSchema>;
export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;

