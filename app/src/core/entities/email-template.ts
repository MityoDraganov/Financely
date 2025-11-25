import z from "zod";
import { baseEntitySchema } from "./base";

// Shared styling schemas
export const emailTypographySchema = z.object({
  fontSize: z.number().min(10).max(72).default(16),
  fontWeight: z.enum(["normal", "400", "500", "600", "700", "bold"]).default("normal"),
  lineHeight: z.number().min(1).max(3).default(1.5),
  letterSpacing: z.number().min(-2).max(5).default(0),
  color: z.string().default(""),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  textDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
}).default({});

export const emailSpacingSchema = z.object({
  paddingTop: z.number().min(0).max(64).default(0),
  paddingRight: z.number().min(0).max(64).default(0),
  paddingBottom: z.number().min(0).max(64).default(0),
  paddingLeft: z.number().min(0).max(64).default(0),
  marginTop: z.number().min(0).max(64).default(0),
  marginRight: z.number().min(0).max(64).default(0),
  marginBottom: z.number().min(0).max(64).default(0),
  marginLeft: z.number().min(0).max(64).default(0),
}).default({});

export const emailBorderSchema = z.object({
  borderWidth: z.number().min(0).max(8).default(0),
  borderColor: z.string().default("#e5e7eb"),
  borderStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  borderRadius: z.number().min(0).max(24).default(0),
}).default({});

export type EmailTypography = z.infer<typeof emailTypographySchema>;
export type EmailSpacing = z.infer<typeof emailSpacingSchema>;
export type EmailBorder = z.infer<typeof emailBorderSchema>;

// Section kinds and types
export type EmailSectionKind = "header" | "body" | "footer";
// Alias for backward compatibility
export type EmailSection = EmailSectionKind;

export type EmailSectionType =
  | "brandHeader"
  | "navHeader"
  | "announcementHeader"
  | "transactionContextHeader"
  | "hero"
  | "content"
  | "summary"
  | "cta"
  | "columns"
  | "featureGrid"
  | "faq"
  | "testimonial"
  | "infoStrip"
  | "contactsFooter"
  | "socialFooter"
  | "legalFooter"
  | "unsubscribeFooter"
  | "brandFooter";

// Section layout schema (for future use)
export const emailSectionLayoutSchema = z.object({
  backgroundMode: z.enum(["default", "brandPrimary", "brandSecondary", "muted", "custom"]).default("default"),
  backgroundColor: z.string().optional(),
  textColorMode: z.enum(["auto", "dark", "light"]).default("auto"),
  paddingY: z.enum(["none", "xs", "sm", "md", "lg"]).default("md"),
  paddingX: z.enum(["none", "xs", "sm", "md"]).default("sm"),
  alignment: z.enum(["left", "center"]).default("left"),
  maxWidth: z.union([z.literal(520), z.literal(600), z.literal(680)]).default(600),
  showBorderTop: z.boolean().optional(),
  showBorderBottom: z.boolean().optional(),
  stackOnMobile: z.boolean().default(true),
});

export type EmailSectionLayout = z.infer<typeof emailSectionLayoutSchema>;

// Block base schema (for current implementation)
const emailBlockBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "subject", 
    "preheader", 
    "text", 
    "button", 
    "divider", 
    "spacer", 
    "image",
    "logo",
    "navigation",
    "footerText",
    "socialLinks",
    "unsubscribe",
    "columns",
    "container"
  ]),
  section: z.enum(["header", "body", "footer"]).default("body"),
});

export const emailSubjectBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("subject"),
  section: z.literal("header").default("header"),
  content: z.string().default(""),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailPreheaderBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("preheader"),
  section: z.literal("header").default("header"),
  content: z.string().default(""),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailLogoBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("logo"),
  section: z.literal("header").default("header"),
  src: z.string().default(""),
  alt: z.string().optional(),
  width: z.number().min(24).max(300).default(120),
  align: z.enum(["left", "center", "right"]).default("center"),
  link: z.string().optional(),
  aspectRatio: z.enum(["auto", "1:1", "16:9", "4:3", "3:2", "21:9", "custom"]).default("auto"),
  aspectRatioCustom: z.number().optional(), // Custom aspect ratio (width/height), e.g., 1.5 for 3:2
  spacing: emailSpacingSchema.optional(),
  border: emailBorderSchema.optional(),
  borderRadius: z.number().min(0).max(24).default(0),
  backgroundColor: z.string().optional(),
});

export const emailNavigationBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("navigation"),
  section: z.literal("header").default("header"),
  links: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).default([]),
  align: z.enum(["left", "center", "right"]).default("center"),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailFooterTextBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("footerText"),
  section: z.literal("footer").default("footer"),
  content: z.string().default(""),
  align: z.enum(["left", "center", "right"]).default("center"),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailSocialLinksBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("socialLinks"),
  section: z.literal("footer").default("footer"),
  links: z.array(z.object({
    platform: z.enum(["facebook", "twitter", "instagram", "linkedin", "youtube", "custom"]),
    url: z.string(),
    icon: z.string().optional(),
  })).default([]),
  align: z.enum(["left", "center", "right"]).default("center"),
  iconSize: z.number().min(16).max(48).default(24),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailUnsubscribeBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("unsubscribe"),
  section: z.literal("footer").default("footer"),
  text: z.string().default("Unsubscribe"),
  url: z.string().default("#unsubscribe"),
  align: z.enum(["left", "center", "right"]).default("center"),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailColumnsBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("columns"),
  columnCount: z.enum(["2", "3", "4"]).default("2"),
  gap: z.number().min(0).max(48).default(16),
  align: z.enum(["left", "center", "right"]).default("left"),
  stackOnMobile: z.boolean().default(true),
  columns: z.array(z.object({
    id: z.string(),
    width: z.number().min(0).max(100).default(50), // percentage
    blocks: z.array(z.any()).default([]), // Nested blocks - will be validated recursively
  })).default([]),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailContainerBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("container"),
  maxWidth: z.union([z.literal(520), z.literal(600), z.literal(680), z.literal(800)]).default(600),
  align: z.enum(["left", "center", "right"]).default("center"),
  padding: z.enum(["none", "xs", "sm", "md", "lg"]).default("md"),
  blocks: z.array(z.any()).default([]), // Nested blocks
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailTextBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("text"),
  content: z.string().default(""),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  emphasize: z.boolean().default(false),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailButtonBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("button"),
  label: z.string().default("Call to action"),
  url: z.string().default("#"),
  variant: z.enum(["primary", "secondary", "link"]).default("primary"),
  align: z.enum(["left", "center", "right"]).default("center"),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
  buttonWidth: z.enum(["auto", "full"]).default("auto"),
  buttonHeight: z.number().min(32).max(64).default(44),
});

export const emailDividerBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  color: z.string().default("#e5e7eb"),
  width: z.number().min(1).max(8).default(1),
  spacing: emailSpacingSchema.optional(),
  align: z.enum(["left", "center", "right"]).default("center"),
  dividerWidth: z.number().min(0).max(100).default(100), // percentage
  backgroundColor: z.string().optional(),
  border: emailBorderSchema.optional(),
});

export const emailSpacerBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("spacer"),
  height: z.number().min(8).max(128).default(16),
  backgroundColor: z.string().optional(),
  spacing: emailSpacingSchema.optional(),
});

export const emailImageBlockSchema = emailBlockBaseSchema.extend({
  type: z.literal("image"),
  src: z.string().default(""),
  alt: z.string().optional(),
  width: z.number().min(24).max(600).default(400),
  align: z.enum(["left", "center", "right"]).default("center"),
  aspectRatio: z.enum(["auto", "1:1", "16:9", "4:3", "3:2", "21:9", "custom"]).default("auto"),
  aspectRatioCustom: z.number().optional(), // Custom aspect ratio (width/height), e.g., 1.5 for 3:2
  spacing: emailSpacingSchema.optional(),
  border: emailBorderSchema.optional(),
  borderRadius: z.number().min(0).max(24).default(0),
  backgroundColor: z.string().optional(),
});

export const emailTemplateBlockSchema = z.discriminatedUnion("type", [
  emailSubjectBlockSchema,
  emailPreheaderBlockSchema,
  emailLogoBlockSchema,
  emailNavigationBlockSchema,
  emailTextBlockSchema,
  emailButtonBlockSchema,
  emailDividerBlockSchema,
  emailSpacerBlockSchema,
  emailImageBlockSchema,
  emailFooterTextBlockSchema,
  emailSocialLinksBlockSchema,
  emailUnsubscribeBlockSchema,
  emailColumnsBlockSchema,
  emailContainerBlockSchema,
]);

export type EmailTemplateBlock = z.infer<typeof emailTemplateBlockSchema>;

export const emailTemplateDesignTokensSchema = z.object({
  background: z.string().default("#ffffff"),
  surface: z.string().default("#f8fafc"),
  text: z.string().default("#0f172a"),
  primary: z.string().default("#2563eb"),
  fontFamily: z.string().default("Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"),
  borderRadius: z.number().min(0).max(24).default(12),
});

export type EmailTemplateDesignTokens = z.infer<typeof emailTemplateDesignTokensSchema>;

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
  blocks: z.array(emailTemplateBlockSchema).default([]),
  designTokens: emailTemplateDesignTokensSchema.default({}),
  // Sections structure - for organizing blocks
  sections: z.object({
    header: z.array(z.string()).default([]), // Array of block IDs
    body: z.array(z.string()).default([]),
    footer: z.array(z.string()).default([]),
  }).optional(),
});

export type EmailTemplateData = z.infer<typeof emailTemplateDataSchema>;

export const emailTemplateSchema = baseEntitySchema.merge(emailTemplateDataSchema);
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;


