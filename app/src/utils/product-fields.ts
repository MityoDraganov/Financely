/**
 * Utility for working with Product entity fields for table mapping
 * Parses the actual Product entity schema to extract mappable fields
 */

import { productDataSchema } from "@/core/entities/product";
import { productTableColumnMappingSchema } from "@/core/entities/template";
import { z } from "zod";

/**
 * Mappable product fields for invoice table columns
 * These are the fields from the Product entity that can be mapped to table columns
 */
export type MappableProductField = z.infer<typeof productTableColumnMappingSchema>["productField"];

/**
 * Product field metadata for UI display and AI prompts
 */
export interface ProductFieldMetadata {
  value: MappableProductField;
  label: string;
  description: string;
  type: "string" | "number";
  required: boolean;
}

/**
 * Extract field metadata from Zod schema
 */
function getFieldMetadataFromSchema(
  schema: z.ZodTypeAny
): { type: "string" | "number"; required: boolean } {
  let type: "string" | "number" = "string";
  let required = true;
  let innerSchema = schema;

  // Check if optional or has default
  if (innerSchema instanceof z.ZodOptional) {
    required = false;
    innerSchema = innerSchema._def.innerType;
  } else if (innerSchema instanceof z.ZodDefault) {
    required = false;
    innerSchema = innerSchema._def.innerType;
  }

  // Determine type
  if (innerSchema instanceof z.ZodString) {
    type = "string";
  } else if (innerSchema instanceof z.ZodNumber) {
    type = "number";
  } else if (innerSchema instanceof z.ZodBoolean) {
    type = "string"; // Treat boolean as string for display
  } else if (innerSchema instanceof z.ZodArray) {
    type = "string"; // Treat array as string for display
  } else if (innerSchema instanceof z.ZodObject) {
    type = "string"; // Treat object as string for display
  }

  return { type, required };
}

/**
 * Generate human-readable label from field name
 */
function getFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Get all mappable product fields with their metadata
 * Parses the actual Product entity schema
 */
export function getMappableProductFields(): ProductFieldMetadata[] {
  // Get the allowed fields from the enum in productTableColumnMappingSchema
  const enumSchema = productTableColumnMappingSchema.shape.productField;
  if (!(enumSchema instanceof z.ZodEnum)) {
    throw new Error("productField must be a ZodEnum");
  }
  
  // Access enum values - Zod stores them in _def.values
  // Try multiple access patterns for different Zod versions
  let allowedFields: string[] = [];
  try {
    const enumDef = enumSchema._def as unknown as { values?: readonly [string, ...string[]] | readonly string[] };
    if (enumDef.values) {
      allowedFields = Array.from(enumDef.values) as string[];
    } else {
      // Fallback: try accessing directly from the enum schema
      const enumValues = (enumSchema as unknown as { _def?: { values?: readonly string[] } })._def?.values;
      if (enumValues && Array.isArray(enumValues)) {
        allowedFields = Array.from(enumValues) as string[];
      } else {
        throw new Error("Could not extract enum values");
      }
    }
  } catch {
    // Final fallback: use the known enum values from the schema definition
    allowedFields = [
      "name",
      "description",
      "price",
      "currency",
      "sku",
      "barcode",
      "category",
      "taxRate",
      "cost",
    ];
  }
  
  if (allowedFields.length === 0) {
    throw new Error("No enum values found in productField schema");
  }

  // Get the product schema shape
  const productShape = productDataSchema.shape;

  // Build metadata for each allowed field
  const fields: ProductFieldMetadata[] = [];

  for (const fieldName of allowedFields) {
    const fieldSchema = (productShape as Record<string, z.ZodTypeAny>)[fieldName];
    if (!fieldSchema) {
      // Field doesn't exist in Product schema - skip it
      continue;
    }

    const { type, required } = getFieldMetadataFromSchema(fieldSchema);
    const label = getFieldLabel(fieldName);

    // Generate description based on field name and type
    let description = `${label.toLowerCase()}`;
    if (type === "number") {
      if (fieldName === "taxRate") {
        description = "Tax rate percentage";
      } else if (fieldName === "price" || fieldName === "cost") {
        description = `${label} amount`;
      } else {
        description = `${label} (number)`;
      }
    } else if (fieldName === "currency") {
      description = "Currency code";
    } else if (fieldName === "sku") {
      description = "Stock keeping unit";
    } else if (fieldName === "barcode") {
      description = "Product barcode";
    }

    fields.push({
      value: fieldName as MappableProductField,
      label,
      description,
      type,
      required,
    });
  }

  return fields;
}

/**
 * Get product field metadata by field name
 */
export function getProductFieldMetadata(
  field: MappableProductField
): ProductFieldMetadata | undefined {
  return getMappableProductFields().find((f) => f.value === field);
}

/**
 * Format product fields for AI prompts
 * Returns a formatted string describing all mappable product fields
 */
export function formatProductFieldsForAI(): string {
  const fields = getMappableProductFields();
  return fields
    .map(
      (field) =>
        `- ${field.value}: ${field.description} (${field.type}${field.required ? ", required" : ", optional"})`
    )
    .join("\n");
}
