import z from "zod";
import { baseEntitySchema } from "./base";

export const emailTemplateMappingDataSchema = z.object({
  orgId: z.string().min(1),
  emailTemplateId: z.string().min(1),
  entityTemplateId: z.string().min(1),
  entityType: z.string().min(1),
  mappings: z.record(z.string(), z.string()),
});

export type EmailTemplateMappingData = z.infer<typeof emailTemplateMappingDataSchema>;

export const emailTemplateMappingSchema = baseEntitySchema.merge(emailTemplateMappingDataSchema);
export type EmailTemplateMapping = z.infer<typeof emailTemplateMappingSchema>;
