import z from "zod";
import { baseEntitySchema } from "./base";
export const subscriptionPlanSchema = z.enum(["free", "starter", "professional", "enterprise"]);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export const organizationDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  
  // Array of user IDs who are members of this organization
  // Roles are stored in the User entity (organizationRoles)
  memberIds: z.array(z.string()).default([]),
  
  // Organization status
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  
  // Subscription and billing
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
  
  // Organization settings
  settings: z
    .object({
      // Branding
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
  
  // Usage and limits
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

/**
 * Helper type for creating organizations.
 * Omits server-managed fields.
 */
export type CreateOrganizationInput = Pick<OrganizationData, "name"> & {
  description?: string;
  logoUrl?: string;
  website?: string;
};

/**
 * Helper function to check if an organization is active.
 * 
 * @param org - The organization to check
 * @returns true if the organization is active
 */
export function isOrganizationActive(org: Organization): boolean {
  return org.status === "active" && org.subscription.status === "active";
}

/**
 * Helper function to check if an organization has a specific feature enabled.
 * 
 * @param org - The organization to check
 * @param feature - The feature name
 * @returns true if the feature is enabled
 */
export function hasFeature(
  org: Organization,
  feature: keyof OrganizationData["settings"]["features"]
): boolean {
  return org.settings.features[feature] === true;
}

/**
 * Helper function to check if a user is a member of an organization.
 * 
 * @param org - The organization
 * @param userId - The user ID to check
 * @returns true if the user is a member
 */
export function isOrganizationMember(org: Organization, userId: string): boolean {
  return org.memberIds.includes(userId);
}

/**
 * Helper function to get the member count of an organization.
 * 
 * @param org - The organization
 * @returns The number of members
 */
export function getMemberCount(org: Organization): number {
  return org.memberIds.length;
}

