import z from "zod";
import { baseEntitySchema } from "./base";

export const PROPOSAL_STATUSES = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export type ProposalStatus = typeof PROPOSAL_STATUSES[keyof typeof PROPOSAL_STATUSES];

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

export const proposalDataSchema = z.object({
  orgId: z.string().min(1),
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(PROPOSAL_STATUSES),
  items: z.array(proposalItemSchema),
  subtotal: z.number().min(0),
  taxTotal: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().min(1),
  terms: z.string().optional(),
  notes: z.string().optional(),
  approval: proposalApprovalSchema.optional(),
});

export type ProposalItem = z.infer<typeof proposalItemSchema>;
export type ProposalApproval = z.infer<typeof proposalApprovalSchema>;
export type ProposalData = z.infer<typeof proposalDataSchema>;
export const proposalSchema = baseEntitySchema.merge(proposalDataSchema);
export type Proposal = z.infer<typeof proposalSchema>;

export const calculateTotals = (items: ProposalItem[], vatRatePct?: number) => {
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const taxTotal = items.reduce((acc, i) => acc + (i.qty * i.unitPrice) * ((i.taxPct ?? vatRatePct ?? 0) / 100), 0);
  const total = subtotal + taxTotal;
  return { subtotal, taxTotal, total };
};
