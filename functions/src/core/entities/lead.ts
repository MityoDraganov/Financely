import z from "zod";
import { baseEntitySchema } from "./base";
import { budgetValueSchema } from "./budget";

export const leadDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  contactId: z.string().optional(), // Reference to the contact if one exists
  widgetType: z.enum(["contactForm", "invoiceRequest", "quoteRequest", "modular"]),
  source: z.enum(["widget", "manual", "import"]).default("widget"),
  // Contact information from the submission
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  budget: budgetValueSchema.optional(),
  budgetMin: z.number().finite().nonnegative().optional(),
  budgetMax: z.number().finite().nonnegative().optional(),
  budgetCurrency: z.string().min(1).optional(),
  // Submission data
  formData: z.record(z.string(), z.unknown()), // All form fields as key-value pairs
  message: z.string().optional(), // Extracted message/notes from form
  status: z.enum(["new", "viewed", "contacted", "converted", "archived"]).default("new"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(), // Internal notes about this lead
});

export const leadSchema = baseEntitySchema.extend({
  data: leadDataSchema,
});

export type LeadData = z.infer<typeof leadDataSchema>;
export type Lead = z.infer<typeof leadSchema>;
