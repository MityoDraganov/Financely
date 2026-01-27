import z from "zod";
import { baseEntitySchema } from "./base";

export enum MetaobjectFieldType {
  // Text
  SINGLE_LINE_TEXT_FIELD = "single_line_text_field",
  MULTI_LINE_TEXT_FIELD = "multi_line_text_field",
  RICH_TEXT_FIELD = "rich_text_field",
  // Number
  NUMBER_INTEGER = "number_integer",
  NUMBER_DECIMAL = "number_decimal",
  MONEY = "money",
  // Media
  FILE_REFERENCE = "file_reference",
  FILE_REFERENCE_IMAGE = "file_reference_image",
  FILE_REFERENCE_VIDEO = "file_reference_video",
  // Reference
  METAOBJECT_REFERENCE = "metaobject_reference",
  // Link
  URL = "url",
  // Date and time
  DATE = "date",
  DATE_TIME = "date_time",
  // Other
  BOOLEAN = "boolean",
  COLOR = "color",
  // Advanced
  JSON = "json",
  // List variants
  LIST_SINGLE_LINE_TEXT_FIELD = "list.single_line_text_field",
  LIST_NUMBER_INTEGER = "list.number_integer",
  LIST_NUMBER_DECIMAL = "list.number_decimal",
  LIST_DATE = "list.date",
  LIST_URL = "list.url",
  LIST_METAOBJECT_REFERENCE = "list.metaobject_reference",
}

export const metaobjectFieldDefinitionSchema = z.object({
  key: z.string().min(1, "Field key is required"),
  name: z.string().min(1, "Field name is required"),
  type: z.nativeEnum(MetaobjectFieldType),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export type MetaobjectFieldDefinition = z.infer<typeof metaobjectFieldDefinitionSchema>;

export const metaobjectDefinitionDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  displayNameKey: z.string().optional(),
  fieldDefinitions: z.array(metaobjectFieldDefinitionSchema).min(1, "At least one field definition is required"),
  access: z.object({
    admin: z.enum(["MERCHANT_READ", "MERCHANT_READ_WRITE"]).default("MERCHANT_READ_WRITE"),
    storefront: z.enum(["PUBLIC_READ", "PUBLIC_READ_WRITE", "PRIVATE"]).default("PRIVATE"),
  }).default({
    admin: "MERCHANT_READ_WRITE",
    storefront: "PRIVATE",
  }),
  capabilities: z.object({
    publishable: z.object({
      enabled: z.boolean(),
    }).optional(),
    translatable: z.object({
      enabled: z.boolean(),
    }).optional(),
  }).optional(),
});

export type MetaobjectDefinitionData = z.infer<typeof metaobjectDefinitionDataSchema>;
export const metaobjectDefinitionSchema = baseEntitySchema.merge(metaobjectDefinitionDataSchema);
export type MetaobjectDefinition = z.infer<typeof metaobjectDefinitionSchema>;

export const metaobjectDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  definitionId: z.string().min(1, "Definition ID is required"),
  handle: z.string().optional(),
  fields: z.record(z.string(), z.unknown()),
  capabilities: z.object({
    publishable: z.object({
      status: z.enum(["ACTIVE", "DRAFT"]).optional(),
    }).optional(),
  }).optional(),
});

export type MetaobjectData = z.infer<typeof metaobjectDataSchema>;
export const metaobjectSchema = baseEntitySchema.merge(metaobjectDataSchema);
export type Metaobject = z.infer<typeof metaobjectSchema>;

export type CreateMetaobjectDefinitionInput = Omit<MetaobjectDefinitionData, "organizationId"> & {
  organizationId: string;
};

export type UpdateMetaobjectDefinitionInput = Partial<Omit<MetaobjectDefinitionData, "organizationId">>;

export type CreateMetaobjectInput = Omit<MetaobjectData, "organizationId"> & {
  organizationId: string;
};

export type UpdateMetaobjectInput = Partial<Omit<MetaobjectData, "organizationId" | "definitionId">>;
