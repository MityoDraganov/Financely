import z from "zod";
import { baseEntitySchema } from "./base";

export const OPPORTUNITY_STAGES = {
  NEW_QUALIFIED: "NEW_QUALIFIED",
  DISCOVERY: "DISCOVERY",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
} as const;

export type OpportunityStage = typeof OPPORTUNITY_STAGES[keyof typeof OPPORTUNITY_STAGES];

export const OPPORTUNITY_STATUSES = {
  OPEN: "open",
  WON: "won",
  LOST: "lost",
} as const;

export type OpportunityStatus = typeof OPPORTUNITY_STATUSES[keyof typeof OPPORTUNITY_STATUSES];

export const opportunityDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  companyName: z.string().optional(),
  ownerUserId: z.string().optional(),
  stage: z.nativeEnum(OPPORTUNITY_STAGES).default(OPPORTUNITY_STAGES.NEW_QUALIFIED),
  status: z.nativeEnum(OPPORTUNITY_STATUSES).default(OPPORTUNITY_STATUSES.OPEN),
  amount: z.number().finite().nonnegative().optional(),
  currency: z.string().default("USD"),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  wonAt: z.string().optional(),
  lostAt: z.string().optional(),
  lostReason: z.string().optional(),
  nextStep: z.string().optional(),
  nextStepDueAt: z.string().optional(),
  proposalIds: z.array(z.string()).default([]),
  invoiceIds: z.array(z.string()).default([]),
  source: z.enum(["lead", "manual", "import"]).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const opportunitySchema = baseEntitySchema.merge(opportunityDataSchema);

export type OpportunityData = z.infer<typeof opportunityDataSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
