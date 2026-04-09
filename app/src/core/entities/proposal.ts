import z from "zod";
import { baseEntitySchema } from "./base";

export const PROPOSAL_STATUSES = {
  CREATED: "CREATED",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  INVOICED: "INVOICED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export const LEGACY_PROPOSAL_STATUSES = {
  DRAFT: "DRAFT",
} as const;

export type ProposalCanonicalStatus = typeof PROPOSAL_STATUSES[keyof typeof PROPOSAL_STATUSES];
export type ProposalStatus = ProposalCanonicalStatus | typeof LEGACY_PROPOSAL_STATUSES.DRAFT;

export const normalizeProposalStatus = (status: string | undefined | null): ProposalCanonicalStatus => {
  if (status === LEGACY_PROPOSAL_STATUSES.DRAFT) {
    return PROPOSAL_STATUSES.CREATED;
  }

  if (status && Object.values(PROPOSAL_STATUSES).includes(status as ProposalCanonicalStatus)) {
    return status as ProposalCanonicalStatus;
  }

  return PROPOSAL_STATUSES.CREATED;
};

export const proposalItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().min(0),
  unitPrice: z.number().min(0),
  taxPct: z.number().min(0).max(100).optional(),
});

export const proposalApprovalSchema = z.object({
  tokenHash: z.string(),
  expiresAt: z.string(),
  sentAt: z.string(),
  approvedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
});

export const proposalDeliveryEventSchema = z.object({
  method: z.enum(["email", "manual", "other"]).default("email"),
  channel: z.string().optional(),
  recipient: z.string().optional(),
  sentAt: z.string(),
  sentByUserId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const proposalDataSchema = z.object({
  // Organization and relationship tracking
  organizationId: z.string().min(1, "Organization ID is required"),
  leadId: z.string().optional(), // Reference to the lead this proposal is based on
  opportunityId: z.string().optional(), // Reference to the opportunity this proposal belongs to
  invoiceId: z.string().optional(), // Reference to the invoice created from this proposal
  
  // Proposal content
  title: z.string().min(1),
  description: z.string().optional(),
  status: z
    .union([
      z.nativeEnum(PROPOSAL_STATUSES),
      z.literal(LEGACY_PROPOSAL_STATUSES.DRAFT),
    ])
    .default(PROPOSAL_STATUSES.CREATED),
  items: z.array(proposalItemSchema),
  subtotal: z.number().min(0),
  taxTotal: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().min(1),
  terms: z.string().optional(),
  notes: z.string().optional(),
  approval: proposalApprovalSchema.optional(),
  deliveryHistory: z.array(proposalDeliveryEventSchema).optional(),
  
  // AI generation metadata
  aiGenerated: z.boolean().default(false),
  aiSuggestionId: z.string().optional(), // Track if this was from an AI suggestion
  isIncomplete: z.boolean().default(false), // True if proposal needs manual completion (e.g., missing products)
  incompleteItems: z.array(z.object({
    description: z.string(),
    reason: z.string(), // Why it's incomplete (e.g., "Product not found")
    suggestedProductId: z.string().optional(), // If a similar product exists
  })).optional(), // Items that couldn't be matched to existing products
});

export type ProposalItem = z.infer<typeof proposalItemSchema>;
export type ProposalApproval = z.infer<typeof proposalApprovalSchema>;
export type ProposalDeliveryEvent = z.infer<typeof proposalDeliveryEventSchema>;
export type ProposalData = z.infer<typeof proposalDataSchema>;
export const proposalSchema = baseEntitySchema.merge(proposalDataSchema);
export type Proposal = z.infer<typeof proposalSchema>;

export const calculateTotals = (items: ProposalItem[], vatRatePct?: number) => {
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const taxTotal = items.reduce((acc, i) => acc + (i.qty * i.unitPrice) * ((i.taxPct ?? vatRatePct ?? 0) / 100), 0);
  const total = subtotal + taxTotal;
  return { subtotal, taxTotal, total };
};
