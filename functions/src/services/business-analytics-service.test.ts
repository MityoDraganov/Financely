import assert from "node:assert";
import { test } from "node:test";
import { BusinessAnalyticsService } from "./business-analytics-service";
import { Invoice } from "../core/entities/invoice";
import { Proposal } from "../core/entities/proposal";
import { Opportunity } from "../core/entities/opportunity";
import { Contact } from "../core/entities/contact";
import { Template } from "../core/entities/template";
import { User } from "../core/entities/user";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-default",
    orgId: "org-1",
    templateId: "tpl-1",
    data: {},
    status: "unsent",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Invoice;
}

function makeProposal(overrides: Partial<Proposal>): Proposal {
  return {
    id: "prop-default",
    organizationId: "org-1",
    title: "Proposal",
    items: [],
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    currency: "USD",
    status: "CREATED",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Proposal;
}

function makeDataset(params?: {
  invoices?: Invoice[];
  proposals?: Proposal[];
  opportunities?: Opportunity[];
}) {
  const contacts: Contact[] = [
    {
      id: "contact-1",
      data: {
        firstName: "Alice",
        lastName: "Cooper",
        email: "alice@example.com",
        organizationId: "org-1",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Contact,
  ];

  const users: User[] = [
    {
      id: "user-1",
      clerkId: "user-1",
      email: "owner@example.com",
      name: "Primary Owner",
      organizationRoles: { "org-1": "owner" },
      preferences: {
        theme: "system",
        language: "en",
        timezone: "UTC",
      },
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as User,
  ];

  const templates: Template[] = [
    {
      id: "tpl-1",
      orgId: "org-1",
      name: "Standard Template",
      pageSize: "A4",
      brand: {
        fonts: ["Inter"],
        colors: {
          primary: "#111111",
          secondary: "#666666",
          accent: "#22c55e",
        },
        margins: {
          top: 96,
          right: 96,
          bottom: 96,
          left: 96,
        },
      },
      elements: [],
      backgroundElements: [],
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Template,
  ];

  return {
    invoices: params?.invoices || [],
    proposals: params?.proposals || [],
    opportunities: params?.opportunities || [],
    contacts,
    users,
    templates,
  };
}

test("business analytics summary computes KPI totals by status and currency", () => {
  const invoices: Invoice[] = [
    makeInvoice({
      id: "inv-sent-usd",
      status: "sent",
      data: {
        issueDate: "2026-03-02",
        dueDate: "2026-04-02",
        total: 100,
        currency: "USD",
        customerId: "contact-1",
        assignedToUserId: "user-1",
      },
    }),
    makeInvoice({
      id: "inv-paid-usd",
      status: "paid",
      paidAt: "2026-03-12T00:00:00.000Z",
      data: {
        issueDate: "2026-03-03",
        dueDate: "2026-03-10",
        total: 80,
        currency: "USD",
        customerId: "contact-1",
      },
    }),
    makeInvoice({
      id: "inv-overdue-eur",
      status: "sent",
      data: {
        issueDate: "2026-03-04",
        dueDate: "2026-03-05",
        total: 50,
        currency: "EUR",
      },
    }),
    makeInvoice({
      id: "inv-unsent-usd",
      status: "unsent",
      data: {
        issueDate: "2026-03-06",
        total: 200,
        currency: "USD",
      },
    }),
    makeInvoice({
      id: "inv-cancelled-usd",
      status: "cancelled",
      data: {
        issueDate: "2026-03-07",
        total: 120,
        currency: "USD",
      },
    }),
    makeInvoice({
      id: "inv-prev-period",
      status: "sent",
      data: {
        issueDate: "2026-02-10",
        dueDate: "2026-02-20",
        total: 60,
        currency: "USD",
      },
    }),
  ];

  const proposals: Proposal[] = [
    makeProposal({
      id: "prop-accepted",
      status: "ACCEPTED",
      total: 400,
      currency: "USD",
      createdAt: "2026-03-05T00:00:00.000Z",
    }),
    makeProposal({
      id: "prop-invoiced",
      status: "INVOICED",
      total: 200,
      currency: "USD",
      createdAt: "2026-03-08T00:00:00.000Z",
    }),
    makeProposal({
      id: "prop-prev-accepted",
      status: "ACCEPTED",
      total: 100,
      currency: "USD",
      createdAt: "2026-02-08T00:00:00.000Z",
    }),
  ];

  const service = new BusinessAnalyticsService(
    makeDataset({ invoices, proposals }),
    new Date("2026-03-20T10:00:00.000Z"),
  );

  const summary = service.getSummary({
    orgId: "org-1",
    dateRange: { start: "2026-03-01", end: "2026-03-31" },
    comparePrevious: true,
  });

  assert.strictEqual(summary.kpis.totalInvoiced.totalsByCurrency.USD, 180);
  assert.strictEqual(summary.kpis.totalInvoiced.totalsByCurrency.EUR, 50);
  assert.strictEqual(summary.kpis.collectedAmount.totalsByCurrency.USD, 80);
  assert.strictEqual(summary.kpis.outstandingAmount.totalsByCurrency.USD, 100);
  assert.strictEqual(summary.kpis.outstandingAmount.totalsByCurrency.EUR, 50);
  assert.strictEqual(summary.kpis.overdueAmount.totalsByCurrency.EUR, 50);
  assert.strictEqual(summary.kpis.totalInvoiced.previousTotalsByCurrency.USD, 60);
  assert.strictEqual(summary.kpis.proposalAcceptedValue.totalsByCurrency.USD, 600);
  assert.strictEqual(summary.kpis.proposalToInvoiceConversionRate.value, 50);
});

test("business analytics aging buckets and top overdue widgets are populated", () => {
  const invoices: Invoice[] = [
    makeInvoice({
      id: "inv-overdue-15",
      status: "sent",
      data: {
        issueDate: "2026-03-01",
        dueDate: "2026-03-05",
        total: 90,
        currency: "USD",
        customerId: "contact-1",
      },
    }),
    makeInvoice({
      id: "inv-overdue-79",
      status: "sent",
      data: {
        issueDate: "2026-01-05",
        dueDate: "2026-01-01",
        total: 40,
        currency: "USD",
        customerId: "contact-1",
      },
      createdAt: "2026-01-05T00:00:00.000Z",
    }),
  ];

  const service = new BusinessAnalyticsService(
    makeDataset({ invoices }),
    new Date("2026-03-20T10:00:00.000Z"),
  );

  const summary = service.getSummary({
    orgId: "org-1",
    dateRange: { start: "2026-01-01", end: "2026-03-31" },
    comparePrevious: false,
  });

  const bucket0to30 = summary.risk.agingBuckets.find((bucket) => bucket.bucket === "0_30");
  const bucket61to90 = summary.risk.agingBuckets.find((bucket) => bucket.bucket === "61_90");

  assert.ok(bucket0to30);
  assert.ok(bucket61to90);
  assert.strictEqual(bucket0to30?.invoiceCount, 1);
  assert.strictEqual(bucket61to90?.invoiceCount, 1);
  assert.strictEqual(summary.risk.topOverdueInvoices.length, 2);
  assert.strictEqual(summary.risk.topOverdueCustomers[0].customerKey, "contact-1");
});

test("average collection days uses paidAt and legacy updatedAt fallback with caveat", () => {
  const invoices: Invoice[] = [
    makeInvoice({
      id: "inv-paid-with-paidAt",
      status: "paid",
      paidAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-16T00:00:00.000Z",
      data: {
        issueDate: "2026-03-10",
        total: 100,
        currency: "USD",
      },
    }),
    makeInvoice({
      id: "inv-paid-legacy",
      status: "paid",
      updatedAt: "2026-03-20T00:00:00.000Z",
      data: {
        issueDate: "2026-03-17",
        total: 50,
        currency: "USD",
      },
    }),
  ];

  const service = new BusinessAnalyticsService(
    makeDataset({ invoices }),
    new Date("2026-03-22T00:00:00.000Z"),
  );

  const summary = service.getSummary({
    orgId: "org-1",
    dateRange: { start: "2026-03-01", end: "2026-03-31" },
    comparePrevious: false,
  });

  assert.strictEqual(summary.kpis.averageCollectionDays.sampleSize, 2);
  assert.strictEqual(summary.kpis.averageCollectionDays.legacyFallbackCount, 1);
  assert.ok(summary.kpis.averageCollectionDays.value !== null);
  assert.ok(
    summary.trust.caveats.some((caveat) => caveat.toLowerCase().includes("missing paidat")),
  );
});

test("owner and market derivation caveats are exposed when mappings are incomplete", () => {
  const invoices: Invoice[] = [
    makeInvoice({
      id: "inv-with-owner-market",
      status: "sent",
      data: {
        issueDate: "2026-03-01",
        dueDate: "2026-03-10",
        total: 100,
        currency: "USD",
        assignedToUserId: "user-1",
        market: "US",
      },
    }),
    makeInvoice({
      id: "inv-missing-owner-market",
      status: "sent",
      data: {
        issueDate: "2026-03-02",
        dueDate: "2026-03-11",
        total: 100,
        currency: "USD",
      },
    }),
  ];

  const service = new BusinessAnalyticsService(
    makeDataset({ invoices }),
    new Date("2026-03-20T00:00:00.000Z"),
  );

  const summary = service.getSummary({
    orgId: "org-1",
    dateRange: { start: "2026-03-01", end: "2026-03-31" },
    comparePrevious: false,
  });

  assert.ok(summary.trust.ownerDerivationCoveragePct < 100);
  assert.ok(summary.trust.marketDerivationCoveragePct < 100);
  assert.ok(summary.trust.caveats.some((caveat) => caveat.includes("Owner attribution")));
  assert.ok(summary.trust.caveats.some((caveat) => caveat.includes("Market attribution")));
});
