import z from "zod";
import { baseEntitySchema } from "./base";

export const contactDataSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    // Normalize: convert single string to array, or keep array
    if (!val) return [];
    if (typeof val === "string") {
      return val.trim() ? [val.trim()] : [];
    }
    return val.filter(p => p && p.trim()).map(p => p.trim());
  }),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive", "prospect", "customer", "lead"]).default("lead"),
  organizationId: z.string().min(1, "Organization ID is required"),
  preferences: z.object({
    preferredContactMethod: z.enum(["email", "phone", "sms"]).default("email"),
    marketingOptIn: z.boolean().default(false),
    newsletterOptIn: z.boolean().default(false),
  }).default({
    preferredContactMethod: "email",
    marketingOptIn: false,
    newsletterOptIn: false,
  }),
  socialMedia: z.object({
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
  }).optional(),
});

export const contactSchema = baseEntitySchema.extend({
  data: contactDataSchema,
});

export type ContactData = z.infer<typeof contactDataSchema>;
export type Contact = z.infer<typeof contactSchema>;

