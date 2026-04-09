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

  // Core identity
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional(),

  // Relationships
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  companyName: z.string().optional(),
  ownerUserId: z.string().optional(),

  // Pipeline
  stage: z.nativeEnum(OPPORTUNITY_STAGES).default(OPPORTUNITY_STAGES.NEW_QUALIFIED),
  status: z.nativeEnum(OPPORTUNITY_STATUSES).default(OPPORTUNITY_STATUSES.OPEN),

  // Commercial value
  amount: z.number().finite().nonnegative().optional(),
  currency: z.string().default("USD"),
  probability: z.number().min(0).max(100).optional(),

  // Dates
  expectedCloseDate: z.string().optional(),
  wonAt: z.string().optional(),
  lostAt: z.string().optional(),

  // Outcome
  lostReason: z.string().optional(),

  // Next step
  nextStep: z.string().optional(),
  nextStepDueAt: z.string().optional(),

  // Linked document IDs
  proposalIds: z.array(z.string()).default([]),
  invoiceIds: z.array(z.string()).default([]),

  // Metadata
  source: z.enum(["lead", "manual", "import"]).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const opportunitySchema = baseEntitySchema.merge(opportunityDataSchema);

export type OpportunityData = z.infer<typeof opportunityDataSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;

/** Returns a probability % that matches the given stage (Salesforce-style defaults). */
export const defaultProbabilityForStage = (stage: OpportunityStage): number => {
  switch (stage) {
    case OPPORTUNITY_STAGES.NEW_QUALIFIED: return 20;
    case OPPORTUNITY_STAGES.DISCOVERY: return 40;
    case OPPORTUNITY_STAGES.PROPOSAL_SENT: return 60;
    case OPPORTUNITY_STAGES.NEGOTIATION: return 80;
    case OPPORTUNITY_STAGES.WON: return 100;
    case OPPORTUNITY_STAGES.LOST: return 0;
  }
};
