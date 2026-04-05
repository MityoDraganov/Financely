import { describe, expect, it } from "vitest";
import {
  normalizeProposalStatus,
  PROPOSAL_STATUSES,
} from "@/core/entities/proposal";
import {
  normalizeInvoiceStatus,
  INVOICE_STATUSES,
} from "@/core/entities/invoice";

describe("status normalization", () => {
  it("maps legacy proposal draft to created", () => {
    expect(normalizeProposalStatus("DRAFT")).toBe(PROPOSAL_STATUSES.CREATED);
  });

  it("keeps canonical proposal statuses", () => {
    expect(normalizeProposalStatus(PROPOSAL_STATUSES.SENT)).toBe(PROPOSAL_STATUSES.SENT);
    expect(normalizeProposalStatus(PROPOSAL_STATUSES.INVOICED)).toBe(PROPOSAL_STATUSES.INVOICED);
  });

  it("maps unknown proposal status to created", () => {
    expect(normalizeProposalStatus("UNKNOWN")).toBe(PROPOSAL_STATUSES.CREATED);
  });

  it("maps legacy invoice draft to unsent", () => {
    expect(normalizeInvoiceStatus("draft")).toBe(INVOICE_STATUSES.UNSENT);
  });

  it("keeps canonical invoice statuses", () => {
    expect(normalizeInvoiceStatus(INVOICE_STATUSES.SENT)).toBe(INVOICE_STATUSES.SENT);
    expect(normalizeInvoiceStatus(INVOICE_STATUSES.PAID)).toBe(INVOICE_STATUSES.PAID);
  });

  it("maps unknown invoice status to unsent", () => {
    expect(normalizeInvoiceStatus("UNKNOWN")).toBe(INVOICE_STATUSES.UNSENT);
  });
});
