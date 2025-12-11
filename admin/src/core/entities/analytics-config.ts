import z from "zod";
import { baseEntitySchema } from "./base";

export const consentDefaultSchema = z.enum(["denied", "granted"]);

export const bannerProviderSchema = z.enum([
  "custom",
  "cookiebot",
  "iubenda",
  "klaro",
]);

export const consentBannerStylingSchema = z.object({
  backgroundColor: z.string().default("#ffffff"),
  textColor: z.string().default("#000000"),
  buttonBackgroundColor: z.string().default("#166534"),
  buttonTextColor: z.string().default("#ffffff"),
  linkColor: z.string().default("#166534"),
  borderColor: z.string().default("#e5e7eb"),
  borderRadius: z.string().default("8px"),
  padding: z.string().default("16px"),
  fontSize: z.string().default("14px"),
  fontFamily: z.string().default("system-ui, -apple-system, sans-serif"),
  fontWeight: z.string().default("400"),
  shadow: z.string().default("0 4px 12px rgba(0, 0, 0, 0.15)"),
  position: z.enum(["bottom", "top", "center"]).default("bottom"),
  maxWidth: z.string().default("600px"),
  acceptButtonText: z.string().default("Accept"),
  rejectButtonText: z.string().default("Reject"),
  message: z.string().default("We use cookies to enhance your browsing experience and analyze site traffic."),
  showRejectButton: z.boolean().default(true),
});

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
  consentBannerStyling: consentBannerStylingSchema.optional(),
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
export type ConsentBannerStyling = z.infer<typeof consentBannerStylingSchema>;
export type AnalyticsConfigData = z.infer<typeof analyticsConfigDataSchema>;
export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;

