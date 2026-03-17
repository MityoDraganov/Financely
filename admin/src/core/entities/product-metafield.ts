import z from "zod";
import { baseEntitySchema } from "./base";
import { metaobjectFieldDefinitionSchema } from "./metaobject";

const productMetafieldTypeSchema = z.enum([
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
]);

const metafieldSelectOptionSchema = z.object({
  label: z.string().min(1, "Option label is required"),
  value: z.string().min(1, "Option value is required"),
});

const metafieldDateSelectionModeSchema = z.enum(["single", "period"]);
const metafieldDatePrecisionSchema = z.enum(["date", "month"]);

const metafieldDateConfigSchema = z.object({
  selectionMode: metafieldDateSelectionModeSchema.default("single"),
  precision: metafieldDatePrecisionSchema.default("date"),
}).default({
  selectionMode: "single",
  precision: "date",
});

const metafieldOptionsSchema = z.object({
  storefrontApiAccess: z.boolean().default(false),
  selectOptions: z.array(metafieldSelectOptionSchema).default([]),
  dateConfig: metafieldDateConfigSchema,
}).default({
  storefrontApiAccess: false,
  selectOptions: [],
  dateConfig: {
    selectionMode: "single",
    precision: "date",
  },
});

export const productMetafieldDefinitionDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(1, "Name is required"),
  type: productMetafieldTypeSchema,
  description: z.string().optional(),
  categoryAssignments: z.array(z.string()).default([]),
  metaobjectDefinitionId: z.string().optional(),
  options: metafieldOptionsSchema,
});

export type ProductMetafieldDefinitionData = z.infer<typeof productMetafieldDefinitionDataSchema>;
export const productMetafieldDefinitionSchema = baseEntitySchema.merge(productMetafieldDefinitionDataSchema);
export type ProductMetafieldDefinition = z.infer<typeof productMetafieldDefinitionSchema>;

export const productMetafieldDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  definitionId: z.string().min(1, "Definition ID is required"),
  value: z.unknown(),
});

export type ProductMetafieldData = z.infer<typeof productMetafieldDataSchema>;
export const productMetafieldSchema = baseEntitySchema.merge(productMetafieldDataSchema);
export type ProductMetafield = z.infer<typeof productMetafieldSchema>;

export type CreateProductMetafieldDefinitionInput = Omit<ProductMetafieldDefinitionData, "organizationId"> & {
  organizationId: string;
};

export type UpdateProductMetafieldDefinitionInput = Partial<Omit<ProductMetafieldDefinitionData, "organizationId">>;

export type CreateProductMetafieldInput = Omit<ProductMetafieldData, "organizationId"> & {
  organizationId: string;
};

export type UpdateProductMetafieldInput = Partial<Omit<ProductMetafieldData, "organizationId" | "productId" | "definitionId">>;
