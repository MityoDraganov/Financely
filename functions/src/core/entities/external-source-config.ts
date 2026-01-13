import z from "zod";
import { baseEntitySchema } from "./base";

export const externalSourceTypeSchema = z.enum([
  "rest-api",
  "graphql",
  "webhook",
]);

export type ExternalSourceType = z.infer<typeof externalSourceTypeSchema>;

export const refreshStrategySchema = z.enum([
  "on-demand",
  "scheduled",
  "event-driven",
]);

export type RefreshStrategy = z.infer<typeof refreshStrategySchema>;

export const authConfigSchema = z.object({
  type: z.enum(["none", "api-key", "basic", "bearer", "oauth2"]),
  apiKeyHeader: z.string().optional(),
  apiKeyValue: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tokenUrl: z.string().optional(),
  scope: z.string().optional(),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

export const schemaMappingSchema = z.record(
  z.string(),
  z.object({
    path: z.string(),
    transform: z.string().optional(),
  })
);

export type SchemaMapping = z.infer<typeof schemaMappingSchema>;

export const cacheConfigSchema = z.object({
  ttl: z.number().default(300),
  invalidationStrategy: z.enum(["time-based", "event-based"]).default("time-based"),
});

export type CacheConfig = z.infer<typeof cacheConfigSchema>;

export const externalSourceConfigDataSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  type: externalSourceTypeSchema,
  endpoint: z.string().url(),
  authConfig: authConfigSchema,
  refreshStrategy: refreshStrategySchema.default("on-demand"),
  schemaMapping: schemaMappingSchema.optional(),
  cacheConfig: cacheConfigSchema.default({ ttl: 300, invalidationStrategy: "time-based" }),
  status: z.enum(["active", "inactive", "error"]).default("inactive"),
  lastSync: z.string().optional(),
  errorLog: z.array(z.object({
    timestamp: z.string(),
    error: z.string(),
  })).default([]),
  enabled: z.boolean().default(false),
  schedule: z.string().optional(),
  query: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export type ExternalSourceConfigData = z.infer<typeof externalSourceConfigDataSchema>;

export const externalSourceConfigSchema = baseEntitySchema.merge(externalSourceConfigDataSchema);
export type ExternalSourceConfig = z.infer<typeof externalSourceConfigSchema>;

