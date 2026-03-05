import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Email Template Mapping
 * 
 * Maps email template placeholder keys to entity field bindings.
 * Mappings are scoped to a specific entity template (e.g., invoice template).
 * 
 * Example:
 * - Email template has placeholder: {{company_name}}
 * - Invoice template has binding: seller.name
 * - Mapping: { "company_name": "seller.name" }
 */
export const emailTemplateMappingDataSchema = z.object({
  orgId: z.string().min(1),
  
  // The email template this mapping is for
  emailTemplateId: z.string().min(1),
  
  // The entity template this mapping is for (e.g., invoice template ID)
  // Optional so path-first templates can be reused across different entity templates.
  entityTemplateId: z.string().optional(),
  
  // Entity type (e.g., "invoice", "quote", etc.)
  entityType: z.string().min(1),
  
  // Mapping of email placeholder keys to entity binding paths
  // Key: email placeholder key (e.g., "company_name")
  // Value: entity binding path (e.g., "seller.name")
  mappings: z.record(z.string(), z.string()),
});

export type EmailTemplateMappingData = z.infer<typeof emailTemplateMappingDataSchema>;

export const emailTemplateMappingSchema = baseEntitySchema.merge(emailTemplateMappingDataSchema);
export type EmailTemplateMapping = z.infer<typeof emailTemplateMappingSchema>;
