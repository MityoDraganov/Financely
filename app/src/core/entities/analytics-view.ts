import z from "zod";
import { baseEntitySchema } from "./base";

export const analyticsViewFilterSchema = z.object({
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  comparePrevious: z.boolean().optional(),
  documentTypes: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  customerKeys: z.array(z.string()).optional(),
  ownerIds: z.array(z.string()).optional(),
  currencies: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  paymentStates: z.array(z.string()).optional(),
  overdueOnly: z.boolean().optional(),
});

export const analyticsViewTableConfigSchema = z.object({
  tab: z.enum(["documents", "customers", "proposals", "collections"]).default("documents"),
  sortField: z.string().default("date"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  groupBy: z.string().nullable().optional(),
  pageSize: z.number().int().min(1).max(250).default(25),
});

export const analyticsViewDataSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  filters: analyticsViewFilterSchema.default({}),
  tableConfig: analyticsViewTableConfigSchema.default({
    tab: "documents",
    sortField: "date",
    sortDirection: "desc",
    pageSize: 25,
  }),
  createdByUserId: z.string().min(1),
});

export const analyticsViewSchema = baseEntitySchema.merge(analyticsViewDataSchema);

export type AnalyticsViewFilter = z.infer<typeof analyticsViewFilterSchema>;
export type AnalyticsViewTableConfig = z.infer<typeof analyticsViewTableConfigSchema>;
export type AnalyticsViewData = z.infer<typeof analyticsViewDataSchema>;
export type AnalyticsView = z.infer<typeof analyticsViewSchema>;
