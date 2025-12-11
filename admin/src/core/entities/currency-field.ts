import z from "zod";

/**
 * Currency Field Linking System
 * Supports linking currency fields for automatic conversion
 */

/**
 * Link types for currency field relationships
 */
export const currencyLinkTypeSchema = z.enum([
  "FX_PAIR", // Direct currency conversion from another field
  "FIXED_MULTIPLIER", // Apply a fixed multiplier
  "FORMULA", // Computed expression
]);

export type CurrencyLinkType = z.infer<typeof currencyLinkTypeSchema>;

/**
 * Currency field link configuration
 */
export const currencyFieldLinkSchema = z.object({
  type: currencyLinkTypeSchema,
  sourceFieldId: z.string().optional(), // ID of the source field (for FX_PAIR)
  targetCurrency: z.string().optional(), // Target currency code (for FX_PAIR)
  multiplier: z.number().optional(), // Fixed multiplier (for FIXED_MULTIPLIER)
  formula: z.string().optional(), // Formula expression (for FORMULA)
  rate: z.number().optional(), // Snapshot rate at time of linking
  rateSource: z.enum(["api", "manual", "snapshot"]).optional(), // Rate source
  rateDate: z.string().optional(), // ISO date string for rate timestamp
});

export type CurrencyFieldLink = z.infer<typeof currencyFieldLinkSchema>;

/**
 * Currency value stored in minor units for precision
 */
export const currencyValueSchema = z.object({
  amountMinor: z.number().int(), // Amount in minor units (cents, etc.)
  currency: z.string().length(3), // ISO 4217 currency code
  scale: z.number().int().min(0).max(8).default(2), // Decimal places
  asOf: z.string(), // ISO date string
});

export type CurrencyValue = z.infer<typeof currencyValueSchema>;

/**
 * Exchange rate information
 */
export const fxRateSchema = z.object({
  base: z.string().length(3), // Base currency code
  quote: z.string().length(3), // Quote currency code
  rate: z.number().positive(), // Exchange rate
  asOf: z.string(), // ISO date string
  source: z.enum(["api", "manual", "snapshot", "triangulation"]), // Rate source
  path: z.array(z.string()).optional(), // Conversion path for triangulation
});

export type FxRate = z.infer<typeof fxRateSchema>;

/**
 * Field dependency for DAG (Directed Acyclic Graph)
 */
export const fieldDependencySchema = z.object({
  fieldId: z.string(),
  dependsOn: z.array(z.string()).default([]), // Array of field IDs this field depends on
});

export type FieldDependency = z.infer<typeof fieldDependencySchema>;

