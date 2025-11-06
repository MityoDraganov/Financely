import z from "zod";
import { baseEntitySchema } from "./base";
export const subscriptionPlanSchema = z.enum(["free", "starter", "professional", "enterprise"]);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export const organizationDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  memberIds: z.array(z.string()).default([]),
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  subscription: z
    .object({
      plan: subscriptionPlanSchema.default("free"),
      status: z.enum(["active", "trialing", "past_due", "cancelled"]).default("active"),
      currentPeriodStart: z.string().optional(),
      currentPeriodEnd: z.string().optional(),
      trialEnd: z.string().optional(),
    })
    .default({
      plan: "free",
      status: "active",
    }),
  settings: z
    .object({
      brandColors: z
        .object({
          primary: z.string().default("#2563eb"),
          secondary: z.string().default("#6b7280"),
          accent: z.string().default("#10b981"),
        })
        .default({
          primary: "#2563eb",
          secondary: "#6b7280",
          accent: "#10b981",
        }),
      
      // Advanced branding and white-label options
      branding: z
        .object({
          customLogo: z.string().url().optional(),
          customFavicon: z.string().url().optional(),
          companyName: z.string().optional(),
          customDomain: z.string().optional(),
          emailFromName: z.string().optional(),
          emailFromAddress: z.string().email().optional(),
          footerText: z.string().optional(),
          description: z.string().optional(),
          brandImages: z.array(z.string().url()).default([]),
        })
        .optional(),
      
      // Defaults for invoices and documents
      defaultCurrency: z.string().default("USD"),
      defaultLanguage: z.string().default("en"),
      defaultTimezone: z.string().default("UTC"),
      
      // Invoice numbering
      invoicePrefix: z.string().default("INV"),
      invoiceNumberStart: z.number().int().min(1).default(1),
      
      // Features and permissions
      features: z
        .object({
          customTemplates: z.boolean().default(true),
          pdfGeneration: z.boolean().default(true),
          emailSending: z.boolean().default(true),
          apiAccess: z.boolean().default(false),
        })
        .default({
          customTemplates: true,
          pdfGeneration: true,
          emailSending: true,
          apiAccess: false,
        }),
      
      // Widget configuration for embeddable widgets
      widgets: z
        .object({
          enabled: z.boolean().default(false),
          contactForm: z
            .object({
              enabled: z.boolean().default(false),
              title: z.string().default("Contact Us"),
              description: z.string().optional(),
              fields: z.array(z.object({
                name: z.string(),
                label: z.string(),
                type: z.enum(["text", "email", "tel", "textarea"]),
                required: z.boolean().default(false),
              })).default([
                { name: "name", label: "Name", type: "text" as const, required: true },
                { name: "email", label: "Email", type: "email" as const, required: true },
                { name: "message", label: "Message", type: "textarea" as const, required: true },
              ]),
              submitButtonText: z.string().default("Send Message"),
              successMessage: z.string().default("Thank you! We'll get back to you soon."),
              position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
              displayMode: z.enum(["floating", "inline"]).default("floating"),
            })
            .optional(),
          invoiceRequest: z
            .object({
              enabled: z.boolean().default(false),
              title: z.string().default("Request Invoice"),
              description: z.string().optional(),
              submitButtonText: z.string().default("Request Invoice"),
              successMessage: z.string().default("Invoice request submitted successfully!"),
              position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
            })
            .optional(),
          quoteRequest: z
            .object({
              enabled: z.boolean().default(false),
              title: z.string().default("Request Quote"),
              description: z.string().optional(),
              submitButtonText: z.string().default("Request Quote"),
              successMessage: z.string().default("Quote request submitted successfully!"),
              position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "center"]).default("bottom-right"),
            })
            .optional(),
        })
        .optional(),
    })
    .default({
      brandColors: {
        primary: "#2563eb",
        secondary: "#6b7280",
        accent: "#10b981",
      },
      defaultCurrency: "USD",
      defaultLanguage: "en",
      defaultTimezone: "UTC",
      invoicePrefix: "INV",
      invoiceNumberStart: 1,
      features: {
        customTemplates: true,
        pdfGeneration: true,
        emailSending: true,
        apiAccess: false,
      },
    }),
  
  usage: z
    .object({
      templateCount: z.number().int().min(0).default(0),
      invoiceCount: z.number().int().min(0).default(0),
      memberCount: z.number().int().min(0).default(0),
      storageBytes: z.number().int().min(0).default(0),
    })
    .default({
      templateCount: 0,
      invoiceCount: 0,
      memberCount: 0,
      storageBytes: 0,
    }),
});

export type OrganizationData = z.infer<typeof organizationDataSchema>;

export const organizationSchema = baseEntitySchema.merge(organizationDataSchema);
export type Organization = z.infer<typeof organizationSchema>;

export type CreateOrganizationInput = Pick<OrganizationData, "name"> & {
  description?: string;
  logoUrl?: string;
  website?: string;
};

export function isOrganizationActive(org: Organization): boolean {
  return org.status === "active" && org.subscription.status === "active";
}

export function hasFeature(
  org: Organization,
  feature: keyof OrganizationData["settings"]["features"]
): boolean {
  return org.settings.features[feature] === true;
}

export function isOrganizationMember(org: Organization, userId: string): boolean {
  return org.memberIds.includes(userId);
}

export function getMemberCount(org: Organization): number {
  return org.memberIds.length;
}

