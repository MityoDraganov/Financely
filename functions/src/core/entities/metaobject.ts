import z from "zod";
import { baseEntitySchema } from "./base";

export const metaobjectFieldDefinitionSchema = z.object({
  key: z.string().min(1, "Field key is required"),
  name: z.string().min(1, "Field name is required"),
  type: z.enum([
    // Text
    "single_line_text_field",
    "multi_line_text_field",
    "rich_text_field",
    "single_line_text_field_choice_list",
    "single_line_text_field_email",
    // Number
    "number_integer",
    "number_decimal",
    "id",
    "money",
    "rating",
    "weight",
    "volume",
    "dimension",
    // Media
    "file_reference",
    "file_reference_image",
    "file_reference_video",
    // Reference
    "article_reference",
    "collection_reference",
    "company_reference",
    "customer_reference",
    "metaobject_reference",
    "order_reference",
    "page_reference",
    "product_reference",
    "variant_reference",
    "mixed_reference",
    // Link
    "link",
    "url",
    // Date and time
    "date",
    "date_time",
    // Other
    "boolean",
    "color",
    // Advanced
    "json",
    // List variants
    "list.single_line_text_field",
    "list.multi_line_text_field",
    "list.number_integer",
    "list.number_decimal",
    "list.date",
    "list.url",
    "list.file_reference",
  ]),
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
