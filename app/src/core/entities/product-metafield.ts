import z from "zod";
import { baseEntitySchema } from "./base";
import {
  createEntityMetafieldDataSchema,
  CreateMetafieldDefinitionInput,
  metafieldDefinitionDataSchema,
  UpdateMetafieldDefinitionInput,
} from "./metafield";

export const productMetafieldDefinitionDataSchema = metafieldDefinitionDataSchema;
export type ProductMetafieldDefinitionData = z.infer<typeof productMetafieldDefinitionDataSchema>;
export const productMetafieldDefinitionSchema = baseEntitySchema.merge(productMetafieldDefinitionDataSchema);
export type ProductMetafieldDefinition = z.infer<typeof productMetafieldDefinitionSchema>;

export const productMetafieldDataSchema = createEntityMetafieldDataSchema("productId", "Product");
export type ProductMetafieldData = z.infer<typeof productMetafieldDataSchema>;
export const productMetafieldSchema = baseEntitySchema.merge(productMetafieldDataSchema);
export type ProductMetafield = z.infer<typeof productMetafieldSchema>;

export type CreateProductMetafieldDefinitionInput = CreateMetafieldDefinitionInput;
export type UpdateProductMetafieldDefinitionInput = UpdateMetafieldDefinitionInput;

export type CreateProductMetafieldInput = Omit<ProductMetafieldData, "organizationId"> & {
  organizationId: string;
};

export type UpdateProductMetafieldInput = Partial<Omit<ProductMetafieldData, "organizationId" | "productId" | "definitionId">>;
