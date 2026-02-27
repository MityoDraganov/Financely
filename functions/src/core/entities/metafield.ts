import z from "zod";
import { baseEntitySchema } from "./base";

export const METAFIELD_TYPE_VALUES = [
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
  "list.metaobject_reference",
] as const;

export const metafieldTypeSchema = z.enum(METAFIELD_TYPE_VALUES);
export type MetafieldType = z.infer<typeof metafieldTypeSchema>;

export const metafieldDefinitionDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(1, "Name is required"),
  type: metafieldTypeSchema,
  description: z.string().optional(),
  categoryAssignments: z.array(z.string()).default([]),
  metaobjectDefinitionId: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().optional(),
  ),
  options: z.object({
    storefrontApiAccess: z.boolean().default(false),
  }).default({
    storefrontApiAccess: false,
  }),
});

export type MetafieldDefinitionData = z.infer<typeof metafieldDefinitionDataSchema>;
export const metafieldDefinitionSchema = baseEntitySchema.merge(metafieldDefinitionDataSchema);
export type MetafieldDefinition = z.infer<typeof metafieldDefinitionSchema>;

export type CreateMetafieldDefinitionInput = Omit<MetafieldDefinitionData, "organizationId"> & {
  organizationId: string;
};

export type UpdateMetafieldDefinitionInput = Partial<Omit<MetafieldDefinitionData, "organizationId">>;

type EntityMetafieldSchemaShape<EntityIdField extends string> = {
  organizationId: z.ZodString;
  definitionId: z.ZodString;
  value: z.ZodUnknown;
} & Record<EntityIdField, z.ZodString>;

export const createEntityMetafieldDataSchema = <EntityIdField extends string>(
  entityIdField: EntityIdField,
  entityLabel: string,
) => {
  const shape = {
    organizationId: z.string().min(1, "Organization ID is required"),
    [entityIdField]: z.string().min(1, `${entityLabel} ID is required`),
    definitionId: z.string().min(1, "Definition ID is required"),
    value: z.unknown(),
  } as EntityMetafieldSchemaShape<EntityIdField>;

  return z.object(shape);
};
