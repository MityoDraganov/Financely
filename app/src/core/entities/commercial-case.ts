import z from "zod";
import { baseEntitySchema } from "./base";

export const COMMERCIAL_CASE_STAGES = {
  INTAKE: "INTAKE",
  QUALIFIED: "QUALIFIED",
  SCOPED: "SCOPED",
  PROPOSAL_DRAFT: "PROPOSAL_DRAFT",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  INVOICED: "INVOICED",
  PAID: "PAID",
  LOST: "LOST",
} as const;

export type CommercialCaseStage =
  typeof COMMERCIAL_CASE_STAGES[keyof typeof COMMERCIAL_CASE_STAGES];

export const COMMERCIAL_CASE_EVENT_TYPES = {
  CASE_CREATED: "case.created",
  CASE_STAGE_CHANGED: "case.stage_changed",
  CASE_OVERRIDE_USED: "case.override_used",
  PROPOSAL_LINKED: "proposal.linked",
  INVOICE_LINKED: "invoice.linked",
  INVOICE_PAID: "invoice.paid",
} as const;

export type CommercialCaseEventType =
  typeof COMMERCIAL_CASE_EVENT_TYPES[keyof typeof COMMERCIAL_CASE_EVENT_TYPES];

const OPEN_CASE_STAGES: CommercialCaseStage[] = [
  COMMERCIAL_CASE_STAGES.INTAKE,
  COMMERCIAL_CASE_STAGES.QUALIFIED,
  COMMERCIAL_CASE_STAGES.SCOPED,
  COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT,
  COMMERCIAL_CASE_STAGES.PROPOSAL_SENT,
  COMMERCIAL_CASE_STAGES.NEGOTIATION,
  COMMERCIAL_CASE_STAGES.WON,
  COMMERCIAL_CASE_STAGES.INVOICED,
];

export const terminalCommercialCaseStages = new Set<CommercialCaseStage>([
  COMMERCIAL_CASE_STAGES.PAID,
  COMMERCIAL_CASE_STAGES.LOST,
]);

export const isTerminalCommercialCaseStage = (stage: CommercialCaseStage): boolean =>
  terminalCommercialCaseStages.has(stage);

const allowedForwardTransitions: Record<CommercialCaseStage, CommercialCaseStage[]> = {
  INTAKE: [COMMERCIAL_CASE_STAGES.QUALIFIED],
  QUALIFIED: [COMMERCIAL_CASE_STAGES.SCOPED],
  SCOPED: [COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT],
  PROPOSAL_DRAFT: [COMMERCIAL_CASE_STAGES.PROPOSAL_SENT],
  PROPOSAL_SENT: [COMMERCIAL_CASE_STAGES.NEGOTIATION],
  NEGOTIATION: [COMMERCIAL_CASE_STAGES.WON],
  WON: [COMMERCIAL_CASE_STAGES.INVOICED],
  INVOICED: [COMMERCIAL_CASE_STAGES.PAID],
  PAID: [],
  LOST: [],
};

export const canTransitionCommercialCaseStage = (
  from: CommercialCaseStage,
  to: CommercialCaseStage,
): boolean => {
  if (from === to) return true;
  if (!isTerminalCommercialCaseStage(from) && to === COMMERCIAL_CASE_STAGES.LOST) {
    return true;
  }
  return allowedForwardTransitions[from]?.includes(to) ?? false;
};

export const commercialCaseDataSchema = z
  .object({
    organizationId: z.string().min(1, "Organization ID is required"),
    title: z.string().min(1, "Title is required"),
    summary: z.string().optional(),
    leadId: z.string().optional(),
    contactId: z.string().optional(),
    ownerUserId: z.string().optional(),
    companyName: z.string().optional(),
    stage: z.nativeEnum(COMMERCIAL_CASE_STAGES).default(COMMERCIAL_CASE_STAGES.INTAKE),
    amount: z.number().finite().nonnegative().optional(),
    currency: z.string().min(1).default("USD"),
    probability: z.number().min(0).max(100).optional(),
    source: z.enum(["lead", "manual", "import"]).optional(),
    expectedCloseDate: z.string().optional(),
    nextAction: z.string().optional(),
    nextActionDueAt: z.string().optional(),
    notes: z.string().optional(),
    lostReason: z.string().optional(),
    wonAt: z.string().optional(),
    lostAt: z.string().optional(),
    invoicedAt: z.string().optional(),
    paidAt: z.string().optional(),
    tags: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (OPEN_CASE_STAGES.includes(data.stage) && (!data.nextAction || !data.nextAction.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextAction"],
        message: "nextAction is required for open case stages",
      });
    }
  });

export const commercialCaseSchema = baseEntitySchema.and(commercialCaseDataSchema);

export type CommercialCaseData = z.infer<typeof commercialCaseDataSchema>;
export type CommercialCase = z.infer<typeof commercialCaseSchema>;

export const commercialCaseEventDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  commercialCaseId: z.string().min(1, "Commercial case ID is required"),
  type: z.nativeEnum(COMMERCIAL_CASE_EVENT_TYPES),
  actorUserId: z.string().optional(),
  fromStage: z.nativeEnum(COMMERCIAL_CASE_STAGES).optional(),
  toStage: z.nativeEnum(COMMERCIAL_CASE_STAGES).optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const commercialCaseEventSchema = baseEntitySchema.merge(commercialCaseEventDataSchema);

export type CommercialCaseEventData = z.infer<typeof commercialCaseEventDataSchema>;
export type CommercialCaseEvent = z.infer<typeof commercialCaseEventSchema>;
