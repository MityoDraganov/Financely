import z from "zod";
import { baseEntitySchema } from "./base";

export const opportunityDataSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  stage: z.enum(["prospecting", "qualification", "proposal", "negotiation", "won", "lost"]).default("prospecting"),
  estimatedValue: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  currency: z.string().optional(),
  assignedToUserId: z.string().optional(),
  proposalIds: z.array(z.string()).default([]),
  invoiceId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const opportunitySchema = baseEntitySchema.merge(opportunityDataSchema);

export type OpportunityData = z.infer<typeof opportunityDataSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
