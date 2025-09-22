import type { ProposalItem } from "./proposal";

export type Invoice = {
  id: string;
  orgId: string;
  proposalId: string;
  customerId: string;
  number: string;
  issueDate: string;
  items: ProposalItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  pdfUrl: string;
  status: "ISSUED";
  createdAt?: string;
};

