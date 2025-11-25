import z from "zod";
import { baseEntitySchema } from "./base";

// Shared styling schemas (reused from v1)
const emailTypographySchema = z.object({
  fontSize: z.number().min(10).max(72).default(16),
  fontWeight: z.enum(["normal", "400", "500", "600", "700", "bold"]).default("normal"),
  lineHeight: z.number().min(1).max(3).default(1.5),
  letterSpacing: z.number().min(-2).max(5).default(0),
  color: z.string().default(""),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  textDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
}).default({});

const emailSpacingSchema = z.object({
  paddingTop: z.number().min(0).max(64).default(0),
  paddingRight: z.number().min(0).max(64).default(0),
  paddingBottom: z.number().min(0).max(64).default(0),
  paddingLeft: z.number().min(0).max(64).default(0),
  marginTop: z.number().min(0).max(64).default(0),
  marginRight: z.number().min(0).max(64).default(0),
  marginBottom: z.number().min(0).max(64).default(0),
  marginLeft: z.number().min(0).max(64).default(0),
}).default({});

const emailBorderSchema = z.object({
  borderWidth: z.number().min(0).max(8).default(0),
  borderColor: z.string().default("#e5e7eb"),
  borderStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  borderRadius: z.number().min(0).max(24).default(0),
}).default({});

// Section kinds and types
export type EmailSectionKind = "header" | "body" | "footer";

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

// Section layout schema
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

// Element base schema
const emailElementBaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    // Header elements
    "brandIdentity",
    "preheaderText",
    "navLinks",
    "announcementBar",
    "transactionStrip",
    // Generic body elements
    "heading",
    "text",
    "button",
    "image",
    "divider",
    "spacer",
    "list",
    "keyValueList",
    // Layout elements
    "columnsLayout",
    "featureCard",
    // Transactional elements
    "invoiceSummary",
    "proposalSummary",
    // Body special elements
    "heroBlock",
    "faqList",
    "testimonial",
    // Footer elements
    "contactInfo",
    "socialLinks",
    "legalLinks",
    "unsubscribeBlock",
    "miniBrandIdentity",
  ]),
});

// Header Elements
export const emailBrandIdentityElementSchema = emailElementBaseSchema.extend({
  type: z.literal("brandIdentity"),
  logoUrl: z.string().optional(),
  brandName: z.string().optional(),
  tagline: z.string().optional(),
  layout: z.enum(["logo-only", "logo-left-text-right", "logo-center-text-below"]).default("logo-center-text-below"),
  logoWidth: z.number().min(24).max(300).default(120),
  showTagline: z.boolean().default(false),
});

export const emailPreheaderTextElementSchema = emailElementBaseSchema.extend({
  type: z.literal("preheaderText"),
  text: z.string().default(""),
  emphasis: z.enum(["normal", "muted", "bold"]).default("normal"),
  typography: emailTypographySchema.optional(),
});

export const emailNavLinksElementSchema = emailElementBaseSchema.extend({
  type: z.literal("navLinks"),
  links: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).default([]),
  alignment: z.enum(["center", "right"]).default("center"),
  typography: emailTypographySchema.optional(),
});

export const emailAnnouncementBarElementSchema = emailElementBaseSchema.extend({
  type: z.literal("announcementBar"),
  label: z.string().optional(),
  text: z.string().default(""),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  typography: emailTypographySchema.optional(),
});

export const emailTransactionStripElementSchema = emailElementBaseSchema.extend({
  type: z.literal("transactionStrip"),
  contextType: z.enum(["invoice", "proposal"]).default("invoice"),
  fields: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).default([]),
  showStatusPill: z.boolean().default(true),
});

// Generic Body Elements
export const emailHeadingElementSchema = emailElementBaseSchema.extend({
  type: z.literal("heading"),
  text: z.string().default(""),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  alignment: z.enum(["left", "center"]).optional(),
  uppercase: z.boolean().default(false),
  typography: emailTypographySchema.optional(),
});

export const emailTextElementSchema = emailElementBaseSchema.extend({
  type: z.literal("text"),
  content: z.string().default(""),
  variant: z.enum(["body", "subtle", "caption"]).default("body"),
  alignment: z.enum(["left", "center"]).optional(),
  typography: emailTypographySchema.optional(),
});

export const emailButtonElementSchema = emailElementBaseSchema.extend({
  type: z.literal("button"),
  label: z.string().default("Call to action"),
  url: z.string().default("#"),
  variant: z.enum(["primary", "secondary", "link"]).default("primary"),
  fullWidth: z.boolean().default(false),
  typography: emailTypographySchema.optional(),
  spacing: emailSpacingSchema.optional(),
});

export const emailImageElementSchema = emailElementBaseSchema.extend({
  type: z.literal("image"),
  src: z.string().default(""),
  alt: z.string().optional(),
  width: z.union([z.number(), z.string()]).optional(), // px or %
  linkUrl: z.string().optional(),
  alignment: z.enum(["left", "center"]).optional(),
  spacing: emailSpacingSchema.optional(),
  border: emailBorderSchema.optional(),
});

export const emailDividerElementSchema = emailElementBaseSchema.extend({
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed"]).default("solid"),
  thickness: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  width: z.union([z.literal("full"), z.number()]).default("full"), // % if number
  alignment: z.enum(["left", "center"]).optional(),
  spacing: emailSpacingSchema.optional(),
});

export const emailSpacerElementSchema = emailElementBaseSchema.extend({
  type: z.literal("spacer"),
  height: z.number().min(8).max(128).default(16),
});

export const emailListElementSchema = emailElementBaseSchema.extend({
  type: z.literal("list"),
  items: z.array(z.string()).default([]),
  listType: z.enum(["bullet", "number"]).default("bullet"),
  typography: emailTypographySchema.optional(),
});

export const emailKeyValueListElementSchema = emailElementBaseSchema.extend({
  type: z.literal("keyValueList"),
  items: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).default([]),
  layout: z.enum(["stacked", "inline"]).default("stacked"),
  typography: emailTypographySchema.optional(),
});

// Layout Elements
export const emailColumnsLayoutElementSchema = emailElementBaseSchema.extend({
  type: z.literal("columnsLayout"),
  columns: z.array(z.object({
    id: z.string(),
    width: z.number().min(0).max(100).default(50), // percentage
    elements: z.array(z.any()).default([]), // Will be EmailElementNode[]
  })).default([]),
  gap: z.enum(["sm", "md"]).default("md"),
  stackOnMobile: z.boolean().default(true),
});

export const emailFeatureCardElementSchema = emailElementBaseSchema.extend({
  type: z.literal("featureCard"),
  title: z.string().default(""),
  description: z.string().default(""),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  typography: emailTypographySchema.optional(),
});

// Transactional Elements
export const emailInvoiceSummaryElementSchema = emailElementBaseSchema.extend({
  type: z.literal("invoiceSummary"),
  showHeader: z.boolean().default(true),
  headerTitle: z.string().optional(),
  showInvoiceNumber: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
  showStatusBadge: z.boolean().default(true),
  showItemsTable: z.boolean().default(true),
  visibleColumns: z.array(z.enum(["description", "qty", "unitPrice", "lineTotal"])).default(["description", "qty", "unitPrice", "lineTotal"]),
  showNetAmount: z.boolean().default(true),
  showVatAmount: z.boolean().default(true),
  showGrossAmount: z.boolean().default(true),
});

export const emailProposalSummaryElementSchema = emailElementBaseSchema.extend({
  type: z.literal("proposalSummary"),
  showTitle: z.boolean().default(true),
  showProposalNumber: z.boolean().default(true),
  showSummaryAmount: z.boolean().default(true),
  showValidityDate: z.boolean().default(true),
  showKeyItems: z.boolean().default(true),
  maxItems: z.number().min(1).max(10).default(5),
});

// Body Special Elements
export const emailHeroBlockElementSchema = emailElementBaseSchema.extend({
  type: z.literal("heroBlock"),
  imageUrl: z.string().optional(),
  headline: z.string().default(""),
  subheadline: z.string().optional(),
  primaryCtaLabel: z.string().optional(),
  primaryCtaUrl: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaUrl: z.string().optional(),
  layout: z.enum(["image-top", "image-left", "image-right", "no-image"]).default("image-top"),
  typography: emailTypographySchema.optional(),
});

export const emailFaqListElementSchema = emailElementBaseSchema.extend({
  type: z.literal("faqList"),
  items: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).default([]),
  typography: emailTypographySchema.optional(),
});

export const emailTestimonialElementSchema = emailElementBaseSchema.extend({
  type: z.literal("testimonial"),
  quoteText: z.string().default(""),
  authorName: z.string().default(""),
  authorTitle: z.string().optional(),
  avatarUrl: z.string().optional(),
  typography: emailTypographySchema.optional(),
});

// Footer Elements
export const emailContactInfoElementSchema = emailElementBaseSchema.extend({
  type: z.literal("contactInfo"),
  organizationName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  typography: emailTypographySchema.optional(),
});

export const emailSocialLinksElementSchema = emailElementBaseSchema.extend({
  type: z.literal("socialLinks"),
  profiles: z.array(z.object({
    type: z.enum(["facebook", "instagram", "linkedin", "tiktok", "x"]),
    url: z.string(),
  })).default([]),
  alignment: z.enum(["left", "center"]).optional(),
});

export const emailLegalLinksElementSchema = emailElementBaseSchema.extend({
  type: z.literal("legalLinks"),
  items: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).default([]),
  typography: emailTypographySchema.optional(),
});

export const emailUnsubscribeBlockElementSchema = emailElementBaseSchema.extend({
  type: z.literal("unsubscribeBlock"),
  text: z.string().default("You are receiving this email because..."),
  unsubscribeUrl: z.string().default("#unsubscribe"),
  preferencesUrl: z.string().optional(),
  typography: emailTypographySchema.optional(),
});

export const emailMiniBrandIdentityElementSchema = emailElementBaseSchema.extend({
  type: z.literal("miniBrandIdentity"),
  logoUrl: z.string().optional(),
  tagline: z.string().optional(),
  year: z.number().optional(),
  typography: emailTypographySchema.optional(),
});

// Element union
export const emailElementNodeSchema = z.discriminatedUnion("type", [
  emailBrandIdentityElementSchema,
  emailPreheaderTextElementSchema,
  emailNavLinksElementSchema,
  emailAnnouncementBarElementSchema,
  emailTransactionStripElementSchema,
  emailHeadingElementSchema,
  emailTextElementSchema,
  emailButtonElementSchema,
  emailImageElementSchema,
  emailDividerElementSchema,
  emailSpacerElementSchema,
  emailListElementSchema,
  emailKeyValueListElementSchema,
  emailColumnsLayoutElementSchema,
  emailFeatureCardElementSchema,
  emailInvoiceSummaryElementSchema,
  emailProposalSummaryElementSchema,
  emailHeroBlockElementSchema,
  emailFaqListElementSchema,
  emailTestimonialElementSchema,
  emailContactInfoElementSchema,
  emailSocialLinksElementSchema,
  emailLegalLinksElementSchema,
  emailUnsubscribeBlockElementSchema,
  emailMiniBrandIdentityElementSchema,
]);

export type EmailElementNode = z.infer<typeof emailElementNodeSchema>;

// Section schema
export const emailSectionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["header", "body", "footer"]),
  type: z.enum([
    "brandHeader",
    "navHeader",
    "announcementHeader",
    "transactionContextHeader",
    "hero",
    "content",
    "summary",
    "cta",
    "columns",
    "featureGrid",
    "faq",
    "testimonial",
    "infoStrip",
    "contactsFooter",
    "socialFooter",
    "legalFooter",
    "unsubscribeFooter",
    "brandFooter",
  ]),
  elements: z.array(emailElementNodeSchema).default([]),
  layout: emailSectionLayoutSchema.default({}),
});

export type EmailSection = z.infer<typeof emailSectionSchema>;

// Design tokens (reused from v1)
export const emailTemplateDesignTokensSchema = z.object({
  background: z.string().default("#ffffff"),
  surface: z.string().default("#f8fafc"),
  text: z.string().default("#0f172a"),
  primary: z.string().default("#2563eb"),
  fontFamily: z.string().default("Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"),
  borderRadius: z.number().min(0).max(24).default(12),
});

export type EmailTemplateDesignTokens = z.infer<typeof emailTemplateDesignTokensSchema>;

// Template data schema v2
export const emailTemplateDataV2Schema = z.object({
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
  sections: z.array(emailSectionSchema).default([]),
  designTokens: emailTemplateDesignTokensSchema.default({}),
});

export type EmailTemplateDataV2 = z.infer<typeof emailTemplateDataV2Schema>;

export const emailTemplateV2Schema = baseEntitySchema.merge(emailTemplateDataV2Schema);
export type EmailTemplateV2 = z.infer<typeof emailTemplateV2Schema>;

