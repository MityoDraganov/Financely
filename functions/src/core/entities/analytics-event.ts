import z from "zod";
import { baseEntitySchema } from "./base";

export const analyticsEventDataSchema = z.object({
  org_id: z.string().min(1),
  site_id: z.string().nullable().optional(),
  brand_name: z.string().nullable().optional(),
  event: z.string().min(1),
  page_path: z.string().nullable().optional(),
  page_title: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});

export const analyticsEventSchema = baseEntitySchema.merge(
  analyticsEventDataSchema,
);

export type AnalyticsEventData = z.infer<typeof analyticsEventDataSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

