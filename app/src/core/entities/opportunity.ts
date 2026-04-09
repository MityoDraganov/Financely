import z from "zod";
import { baseEntitySchema } from "./base";

export const OPPORTUNITY_STAGES = {
  PROSPECTING: "prospecting",
  QUALIFICATION: "qualification",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
} as const;

export type OpportunityStage = typeof OPPORTUNITY_STAGES[keyof typeof OPPORTUNITY_STAGES];

export const opportunityDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  leadId: z.string().optional(),       // Source lead this was converted from
  contactId: z.string().optional(),    // Associated contact
  title: z.string().min(1),
  description: z.string().optional(),
  stage: z.enum(["prospecting", "qualification", "proposal", "negotiation", "won", "lost"]).default("prospecting"),
  estimatedValue: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(), // 0-100 %
  expectedCloseDate: z.string().optional(),
  currency: z.string().optional(),
  assignedToUserId: z.string().optional(),
  proposalIds: z.array(z.string()).default([]),
  invoiceId: z.string().optional(),    // Invoice created after winning
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const opportunitySchema = baseEntitySchema.merge(opportunityDataSchema);

export type OpportunityData = z.infer<typeof opportunityDataSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
