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
      
      // Advanced branding and white-label options
      branding: z
        .object({
          customLogo: z.string().url().optional(),
          customFavicon: z.string().url().optional(),
          companyName: z.string().optional(), // Override app name
          customDomain: z.string().optional(), // For white-label
          emailFromName: z.string().optional(),
          emailFromAddress: z.string().email().optional(),
          footerText: z.string().optional(),
          description: z.string().optional(),
          brandImages: z.array(z.string().url()).default([]),
          socialLinks: z.object({
            twitter: z.string().optional(),
            linkedin: z.string().optional(),
            facebook: z.string().optional()
          }).optional()
        })
        .optional(),
      
      // Security settings
      security: z
        .object({
          ssoEnabled: z.boolean().default(false),
          samlConfig: z.object({
            metadataUrl: z.string().optional(),
            certificate: z.string().optional(),
            attributeMapping: z.record(z.string()).optional(),
          }).optional(),
        })
        .default({
          ssoEnabled: false,
        }),
      
      // Custom roles for the organization
      customRoles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        permissions: z.array(z.enum([
          "invoices.create", "invoices.read", "invoices.update", "invoices.delete",
          "templates.create", "templates.read", "templates.update", "templates.delete",
          "users.create", "users.read", "users.update", "users.delete",
          "settings.read", "settings.update",
          "billing.read", "billing.update",
          "organizations.read", "organizations.update"
        ])),
        createdAt: z.string(),
        updatedAt: z.string(),
      })).default([]),
      
      // Defaults for invoices and documents
      defaultCurrency: z.string().default("USD"),
      defaultLanguage: z.string().default("en"),
      defaultTimezone: z.string().default("UTC"),
      // Organization location for compliance
      country: z.string().optional(), // ISO country code (e.g., "US", "GB", "DE")
      region: z.enum(["US", "EU", "CA", "AU", "UK"]).optional(), // Invoice compliance region
      // Organization address
      address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(), // Full country name (e.g., "United States")
      }).optional(),
      // Organization contact information
      email: z.string().email().optional(),
      phone: z.string().optional(),
      
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
      
      // AI and automation settings
      ai: z
        .object({
          autoProposalSuggestions: z.boolean().default(false),
        })
        .default({
          autoProposalSuggestions: false,
        }),
      
      // Billing and subscription settings
      billing: z
        .object({
          autoRenew: z.boolean().default(true),
          usageAlerts: z.boolean().default(true),
          usageAlertThresholds: z
            .object({
              warning: z.number().int().min(0).max(100).default(75),
              critical: z.number().int().min(0).max(100).default(90),
            })
            .default({
              warning: 75,
              critical: 90,
            }),
          billingEmail: z.string().email().optional(),
        })
        .optional(),
      
      // Widget configuration for embeddable widgets
      widgets: z
        .object({
          enabled: z.boolean().default(false),
          // Version metadata for widgets
          metadata: z
            .object({
              version: z.number().int().default(1),
              lastSavedAt: z.string().optional(),
            })
            .optional(),
          // Version history - stores previous versions of widget configurations
          versions: z.array(
            z.object({
              version: z.number().int(),
              widgetType: z.enum(["contactForm", "invoiceRequest", "quoteRequest", "all"]),
              widgets: z.any(), // Full widget configuration snapshot
              createdAt: z.string(),
              description: z.string().optional(),
            })
          ).default([]),
          contactForm: z
            .object({
              enabled: z.boolean().default(false),
              title: z.string().default("Contact Us"),
              description: z.string().optional(),
              // Widget-specific styling configuration
              styling: z
                .object({
                  // Colors
                  primaryColor: z.string().default("#2563eb"),
                  secondaryColor: z.string().default("#6b7280"),
                  backgroundColor: z.string().default("#ffffff"),
                  textColor: z.string().default("#111827"),
                  borderColor: z.string().default("#d1d5db"),
                  errorColor: z.string().default("#ef4444"),
                  successColor: z.string().default("#10b981"),
                  // Typography
                  fontFamily: z.string().default("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"),
                  fontSize: z.string().default("14px"),
                  fontWeight: z.string().default("400"),
                  // Spacing
                  padding: z.string().default("12px"),
                  gap: z.string().default("16px"),
                  borderRadius: z.string().default("8px"),
                  // Button styling
                  buttonPadding: z.string().default("12px 24px"),
                  buttonBorderRadius: z.string().default("8px"),
                  buttonFontWeight: z.string().default("600"),
                  // Modal/Container styling
                  modalBackdropOpacity: z.string().default("0.5"),
                  modalBorderRadius: z.string().default("12px"),
                  modalMaxWidth: z.string().default("500px"),
                  // Shadow
                  shadow: z.string().default("0 4px 12px rgba(0, 0, 0, 0.15)"),
                })
                .optional(),
              // Widget-specific localization
              localization: z
                .object({
                  defaultLanguage: z.literal("en").default("en"),
                  languages: z.record(z.string(), z.record(z.string(), z.string())).default({}),
                })
                .optional(),
              // Built-in fields configuration
              builtInFields: z
                .object({
                  name: z.object({ enabled: z.boolean().default(true), required: z.boolean().default(true), label: z.string().default("Name") }).optional(),
                  email: z.object({ enabled: z.boolean().default(true), required: z.boolean().default(true), label: z.string().default("Email") }).optional(),
                  phone: z.object({ enabled: z.boolean().default(false), required: z.boolean().default(false), label: z.string().default("Phone") }).optional(),
                  company: z.object({ enabled: z.boolean().default(false), required: z.boolean().default(false), label: z.string().default("Company") }).optional(),
                  message: z.object({ enabled: z.boolean().default(true), required: z.boolean().default(false), label: z.string().default("Message") }).optional(),
                })
                .optional(),
              // Custom metadata fields
              customFields: z.array(z.object({
                id: z.string(),
                name: z.string(),
                label: z.string(),
                type: z.enum(["text", "email", "tel", "textarea", "number", "select", "checkbox", "date"]),
                required: z.boolean().default(false),
                placeholder: z.string().optional(),
                options: z.array(z.string()).optional(), // For select type
                validation: z.object({
                  min: z.number().optional(),
                  max: z.number().optional(),
                  pattern: z.string().optional(),
                }).optional(),
                order: z.number().default(0),
              })).default([]),
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
              // Widget-specific styling configuration
              styling: z
                .object({
                  // Colors
                  primaryColor: z.string().default("#2563eb"),
                  secondaryColor: z.string().default("#6b7280"),
                  backgroundColor: z.string().default("#ffffff"),
                  textColor: z.string().default("#111827"),
                  borderColor: z.string().default("#d1d5db"),
                  errorColor: z.string().default("#ef4444"),
                  successColor: z.string().default("#10b981"),
                  // Typography
                  fontFamily: z.string().default("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"),
                  fontSize: z.string().default("14px"),
                  fontWeight: z.string().default("400"),
                  // Spacing
                  padding: z.string().default("12px"),
                  gap: z.string().default("16px"),
                  borderRadius: z.string().default("8px"),
                  // Button styling
                  buttonPadding: z.string().default("12px 24px"),
                  buttonBorderRadius: z.string().default("8px"),
                  buttonFontWeight: z.string().default("600"),
                  // Modal/Container styling
                  modalBackdropOpacity: z.string().default("0.5"),
                  modalBorderRadius: z.string().default("12px"),
                  modalMaxWidth: z.string().default("500px"),
                  // Shadow
                  shadow: z.string().default("0 4px 12px rgba(0, 0, 0, 0.15)"),
                })
                .optional(),
              // Widget-specific localization
              localization: z
                .object({
                  defaultLanguage: z.literal("en").default("en"),
                  languages: z.record(z.string(), z.record(z.string(), z.string())).default({}),
                })
                .optional(),
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
              // Widget-specific styling configuration
              styling: z
                .object({
                  // Colors
                  primaryColor: z.string().default("#2563eb"),
                  secondaryColor: z.string().default("#6b7280"),
                  backgroundColor: z.string().default("#ffffff"),
                  textColor: z.string().default("#111827"),
                  borderColor: z.string().default("#d1d5db"),
                  errorColor: z.string().default("#ef4444"),
                  successColor: z.string().default("#10b981"),
                  // Typography
                  fontFamily: z.string().default("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"),
                  fontSize: z.string().default("14px"),
                  fontWeight: z.string().default("400"),
                  // Spacing
                  padding: z.string().default("12px"),
                  gap: z.string().default("16px"),
                  borderRadius: z.string().default("8px"),
                  // Button styling
                  buttonPadding: z.string().default("12px 24px"),
                  buttonBorderRadius: z.string().default("8px"),
                  buttonFontWeight: z.string().default("600"),
                  // Modal/Container styling
                  modalBackdropOpacity: z.string().default("0.5"),
                  modalBorderRadius: z.string().default("12px"),
                  modalMaxWidth: z.string().default("500px"),
                  // Shadow
                  shadow: z.string().default("0 4px 12px rgba(0, 0, 0, 0.15)"),
                })
                .optional(),
              // Widget-specific localization
              localization: z
                .object({
                  defaultLanguage: z.literal("en").default("en"),
                  languages: z.record(z.string(), z.record(z.string(), z.string())).default({}),
                })
                .optional(),
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

