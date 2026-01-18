import z from "zod";
import { baseEntitySchema } from "./base";
import { duplicationOptionsSchema } from "./duplication-mode";

/**
 * Duplication Job Status
 */
export const duplicationJobStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export type DuplicationJobStatus = z.infer<typeof duplicationJobStatusSchema>;

/**
 * Duplication Job Progress
 */
export const duplicationJobProgressSchema = z.object({
  totalEntities: z.number().int().min(0).default(0),
  processedEntities: z.number().int().min(0).default(0),
  currentEntityType: z.string().optional(),
  currentEntityId: z.string().optional(),
  percentage: z.number().min(0).max(100).default(0),
});

export type DuplicationJobProgress = z.infer<typeof duplicationJobProgressSchema>;

/**
 * Duplication Job Error
 */
export const duplicationJobErrorSchema = z.object({
  entityType: z.string(),
  entityId: z.string().optional(),
  error: z.string(),
  timestamp: z.string(),
});

export type DuplicationJobError = z.infer<typeof duplicationJobErrorSchema>;

/**
 * Duplication Job Statistics
 */
export const duplicationJobStatsSchema = z.object({
  entitiesCreated: z.record(z.string(), z.number().int().min(0)).default({}),
  entitiesSkipped: z.number().int().min(0).default(0),
  entitiesFailed: z.number().int().min(0).default(0),
  conflictsResolved: z.number().int().min(0).default(0),
});

export type DuplicationJobStats = z.infer<typeof duplicationJobStatsSchema>;

/**
 * Duplication Job Data
 */
export const duplicationJobDataSchema = z.object({
  // Source organization ID
  sourceOrgId: z.string().min(1),
  
  // Target organization ID (created during duplication)
  targetOrgId: z.string().optional(),
  
  // Target organization name
  targetOrgName: z.string().min(1),
  
  // Created by user ID
  createdBy: z.string().min(1),
  
  // Duplication options
  options: duplicationOptionsSchema,
  
  // Job status
  status: duplicationJobStatusSchema.default("pending"),
  
  // Progress tracking
  progress: duplicationJobProgressSchema.default({
    totalEntities: 0,
    processedEntities: 0,
    percentage: 0,
  }),
  
  // Errors encountered during duplication
  errors: z.array(duplicationJobErrorSchema).default([]),
  
  // Statistics
  stats: duplicationJobStatsSchema.default({
    entitiesCreated: {},
    entitiesSkipped: 0,
    entitiesFailed: 0,
    conflictsResolved: 0,
  }),
  
  // Started/completed timestamps
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  
  // Error message (if job failed)
  errorMessage: z.string().optional(),
});

export type DuplicationJobData = z.infer<typeof duplicationJobDataSchema>;

export const duplicationJobSchema = baseEntitySchema.merge(duplicationJobDataSchema);
export type DuplicationJob = z.infer<typeof duplicationJobSchema>;
