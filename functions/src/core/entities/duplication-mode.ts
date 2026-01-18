import z from "zod";

/**
 * Duplication Options
 */
export const duplicationOptionsSchema = z.object({
  includePrices: z.boolean().default(true),
  resetWorkflows: z.boolean().default(true),
  resetWebhooks: z.boolean().default(true),
  resetApiKeys: z.boolean().default(true),
  resetDomains: z.boolean().default(true),
  conflictResolution: z.enum(["suffix", "user_input", "skip"]).default("suffix"),
  customSuffix: z.string().optional(),
});

export type DuplicationOptions = z.infer<typeof duplicationOptionsSchema>;
