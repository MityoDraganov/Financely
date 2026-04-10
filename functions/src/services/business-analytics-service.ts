import {
  BusinessAnalyticsBreakdownRow,
  BusinessAnalyticsDateRange,
  BusinessAnalyticsFilters,
  BusinessAnalyticsRecordsPayload,
  BusinessAnalyticsRecordsResponse,
  BusinessAnalyticsRecordSort,
  BusinessAnalyticsSummaryPayload,
  BusinessAnalyticsSummaryResponse,
  CurrencyDelta,
  CurrencyTotals,
} from "../core/entities/business-analytics";
import {
  INVOICE_STATUSES,
  Invoice,
  normalizeInvoiceStatus,
} from "../core/entities/invoice";
import {
  PROPOSAL_STATUSES,
  Proposal,
  normalizeProposalStatus,
} from "../core/entities/proposal";
import { Opportunity } from "../core/entities/opportunity";
import { Contact } from "../core/entities/contact";
import { Template } from "../core/entities/template";
import { User } from "../core/entities/user";

interface BusinessAnalyticsDataset {
  invoices: Invoice[];
  proposals: Proposal[];
  opportunities: Opportunity[];
  contacts: Contact[];
  users: User[];
  templates: Template[];
}

interface NormalizedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  currency: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  usedLegacyPaidAtFallback: boolean;
  customerKey: string;
  customerLabel: string;
  ownerId: string | null;
  market: string | null;
  templateId: string | null;
  templateLabel: string;
  paymentState: string;
}

interface NormalizedProposal {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date | null;
  customerKey: string;
  customerLabel: string;
  ownerId: string | null;
  market: string | null;
  linkedInvoiceId: string | null;
}

interface NormalizedOpportunity {
  id: string;
  stage: string;
  estimatedValue: number;
  currency: string;
  createdAt: Date | null;
  ownerId: string | null;
  market: string | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT: BusinessAnalyticsRecordSort = {
  field: "date",
  direction: "desc",
};

function startOfDayUTC(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfDayUTC(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseNumericValue(value: unknown): number {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseCurrency(value: unknown): string {
  if (typeof value !== "string") return "UNKNOWN";
  const normalized = value.trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function pickFirst(data: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const value = getNestedValue(data, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function addToCurrencyTotals(
  target: CurrencyTotals,
  currency: string,
  amount: number,
): void {
  if (!Number.isFinite(amount)) return;
  const key = currency || "UNKNOWN";
  target[key] = (target[key] || 0) + amount;
}

function currencyTotalsDelta(
  current: CurrencyTotals,
  previous: CurrencyTotals,
): CurrencyDelta {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const output: CurrencyDelta = {};

  for (const key of keys) {
    const curr = current[key] || 0;
    const prev = previous[key] || 0;
    if (prev === 0) {
      output[key] = curr === 0 ? 0 : null;
      continue;
    }
    output[key] = ((curr - prev) / prev) * 100;
  }

  return output;
}

function scalarDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function sumCurrencyTotals(totals: CurrencyTotals): number {
  return Object.values(totals).reduce((acc, value) => acc + value, 0);
}

function parseAndNormalizeDateRange(
  range: BusinessAnalyticsDateRange,
): BusinessAnalyticsDateRange {
  const startDate = parseDateValue(range.start);
  const endDate = parseDateValue(range.end);
  if (!startDate || !endDate || startDate > endDate) {
    const now = new Date();
    const end = endOfDayUTC(now);
    const start = startOfDayUTC(new Date(end.getTime() - 29 * DAY_IN_MS));
    return { start: toISODate(start), end: toISODate(end) };
  }

  return {
    start: toISODate(startOfDayUTC(startDate)),
    end: toISODate(endOfDayUTC(endDate)),
  };
}

function previousDateRange(range: BusinessAnalyticsDateRange): BusinessAnalyticsDateRange {
  const start = parseDateValue(range.start);
  const end = parseDateValue(range.end);
  if (!start || !end) return range;

  const normalizedStart = startOfDayUTC(start);
  const normalizedEnd = endOfDayUTC(end);
  const daySpan = Math.max(
    1,
    Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_IN_MS) + 1,
  );
  const previousEnd = endOfDayUTC(new Date(normalizedStart.getTime() - DAY_IN_MS));
  const previousStart = startOfDayUTC(
    new Date(previousEnd.getTime() - (daySpan - 1) * DAY_IN_MS),
  );

  return {
    start: toISODate(previousStart),
    end: toISODate(previousEnd),
  };
}

function buildDailyBuckets(range: BusinessAnalyticsDateRange): string[] {
  const start = parseDateValue(range.start);
  const end = parseDateValue(range.end);
  if (!start || !end) return [];

  const output: string[] = [];
  const cursor = startOfDayUTC(start);
  const finalDay = startOfDayUTC(end);
  while (cursor <= finalDay) {
    output.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}

function withinRange(date: Date | null, range: BusinessAnalyticsDateRange): boolean {
  if (!date) return false;
  const start = parseDateValue(range.start);
  const end = parseDateValue(range.end);
  if (!start || !end) return false;
  const value = date.getTime();
  return value >= startOfDayUTC(start).getTime() && value <= endOfDayUTC(end).getTime();
}

function normalizeFilters(filters: BusinessAnalyticsFilters | undefined): BusinessAnalyticsFilters {
  return {
    documentTypes: filters?.documentTypes?.filter(Boolean) || [],
    statuses: filters?.statuses?.filter(Boolean) || [],
    customerKeys: filters?.customerKeys?.filter(Boolean) || [],
    ownerIds: filters?.ownerIds?.filter(Boolean) || [],
    currencies: filters?.currencies?.map((x) => x.toUpperCase()) || [],
    markets: filters?.markets?.filter(Boolean) || [],
    paymentStates: filters?.paymentStates?.map((x) => x.toLowerCase()) || [],
    overdueOnly: Boolean(filters?.overdueOnly),
  };
}

function includeDocumentType(filters: BusinessAnalyticsFilters, docType: string): boolean {
  if (!filters.documentTypes || filters.documentTypes.length === 0) return true;
  return filters.documentTypes.includes(docType);
}

function normalizeContactMap(contacts: Contact[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const contact of contacts) {
    const rawData =
      typeof (contact as unknown as { data?: unknown }).data === "object" &&
      (contact as unknown as { data?: unknown }).data !== null
        ? ((contact as unknown as { data?: Record<string, unknown> }).data as Record<
            string,
            unknown
          >)
        : (contact as unknown as Record<string, unknown>);
    const firstName = typeof rawData.firstName === "string" ? rawData.firstName : "";
    const lastName = typeof rawData.lastName === "string" ? rawData.lastName : "";
    const fullName = `${firstName} ${lastName}`.trim();
    const company = typeof rawData.company === "string" ? rawData.company.trim() : "";
    output[contact.id] = fullName || company || `Contact ${contact.id.slice(0, 6)}`;
  }
  return output;
}

function normalizeTemplateMap(templates: Template[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const template of templates) {
    output[template.id] = template.name || `Template ${template.id.slice(0, 6)}`;
  }
  return output;
}

function normalizeUserMap(users: User[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const user of users) {
    output[user.id] = user.name || user.email || `User ${user.id.slice(0, 6)}`;
  }
  return output;
}

function getInvoiceData(invoice: Invoice): Record<string, unknown> {
  return (invoice.data || {}) as Record<string, unknown>;
}

function normalizeInvoices(
  invoices: Invoice[],
  contactMap: Record<string, string>,
  templateMap: Record<string, string>,
): NormalizedInvoice[] {
  return invoices.map((invoice) => {
    const data = getInvoiceData(invoice);

    const status = normalizeInvoiceStatus(invoice.status);
    const currency = parseCurrency(
      pickFirst(data, [
        "currency",
        "totals.currency",
        "invoice.currency",
      ]),
    );
    const amount = parseNumericValue(
      pickFirst(data, [
        "total",
        "totals.grandTotal",
        "invoice.total",
        "amount",
      ]),
    );

    const invoiceDate = parseDateValue(
      pickFirst(data, ["invoiceDate", "issueDate", "date"]) || invoice.createdAt,
    );
    const dueDate = parseDateValue(
      pickFirst(data, ["dueDate", "paymentDueDate", "invoice.dueDate"]),
    );

    const explicitPaidAt = parseDateValue((invoice as unknown as { paidAt?: unknown }).paidAt);
    const fallbackPaidAt =
      status === INVOICE_STATUSES.PAID ? parseDateValue(invoice.updatedAt) : null;
    const paidAt = explicitPaidAt || fallbackPaidAt;
    const usedLegacyPaidAtFallback = !explicitPaidAt && Boolean(fallbackPaidAt);

    const customerId = String(
      pickFirst(data, [
        "customerId",
        "contactId",
        "buyer.id",
        "customer.id",
      ]) || "",
    ).trim();
    const rawCustomerLabel = String(
      pickFirst(data, [
        "buyer.name",
        "customer.name",
        "client.name",
        "buyer.company",
        "customer.company",
      ]) || "",
    ).trim();
    const customerLabel =
      (customerId && contactMap[customerId]) ||
      rawCustomerLabel ||
      `Customer ${invoice.id.slice(0, 6)}`;
    const customerKey = customerId || `name:${customerLabel.toLowerCase()}`;

    const ownerIdCandidate = pickFirst(
      {
        ...(invoice as unknown as Record<string, unknown>),
        ...data,
      },
      [
        "assignedToUserId",
        "ownerId",
        "salesOwnerUserId",
        "createdByUserId",
      ],
    );
    const ownerId =
      typeof ownerIdCandidate === "string" && ownerIdCandidate.trim()
        ? ownerIdCandidate.trim()
        : null;

    const marketCandidate = pickFirst(data, [
      "market",
      "region",
      "country",
      "buyer.country",
      "customer.country",
    ]);
    const market =
      typeof marketCandidate === "string" && marketCandidate.trim()
        ? marketCandidate.trim()
        : null;

    const templateId =
      typeof invoice.templateId === "string" && invoice.templateId.trim()
        ? invoice.templateId
        : null;
    const templateLabel = templateId
      ? templateMap[templateId] || `Template ${templateId.slice(0, 6)}`
      : "Unknown template";
    const invoiceNumber = String(
      pickFirst(data, ["invoiceNumber", "number", "invoice.number"]) || invoice.id,
    );

    return {
      id: invoice.id,
      invoiceNumber,
      status,
      amount,
      currency,
      invoiceDate,
      dueDate,
      paidAt,
      usedLegacyPaidAtFallback,
      customerKey,
      customerLabel,
      ownerId,
      market,
      templateId,
      templateLabel,
      paymentState: status,
    };
  });
}

function normalizeProposals(
  proposals: Proposal[],
  contactMap: Record<string, string>,
): NormalizedProposal[] {
  return proposals.map((proposal) => {
    const status = normalizeProposalStatus(proposal.status);
    const currency = parseCurrency((proposal as unknown as Record<string, unknown>).currency);
    const total = parseNumericValue((proposal as unknown as Record<string, unknown>).total);
    const createdAt = parseDateValue(proposal.createdAt);

    const contactId = String(
      (proposal as unknown as Record<string, unknown>).contactId || "",
    ).trim();
    const rawCustomerLabel = String(
      (proposal as unknown as Record<string, unknown>).customerName ||
        (proposal as unknown as Record<string, unknown>).title ||
        "",
    ).trim();
    const customerLabel =
      (contactId && contactMap[contactId]) ||
      rawCustomerLabel ||
      `Proposal ${proposal.id.slice(0, 6)}`;
    const customerKey = contactId || `proposal:${proposal.id}`;

    const ownerIdValue = (proposal as unknown as Record<string, unknown>).assignedToUserId;
    const ownerId =
      typeof ownerIdValue === "string" && ownerIdValue.trim()
        ? ownerIdValue.trim()
        : null;

    const marketValue =
      (proposal as unknown as Record<string, unknown>).market ||
      (proposal as unknown as Record<string, unknown>).country;
    const market =
      typeof marketValue === "string" && marketValue.trim()
        ? marketValue.trim()
        : null;

    const invoiceIdValue = (proposal as unknown as Record<string, unknown>).invoiceId;
    const linkedInvoiceId =
      typeof invoiceIdValue === "string" && invoiceIdValue.trim()
        ? invoiceIdValue.trim()
        : null;

    return {
      id: proposal.id,
      status,
      total,
      currency,
      createdAt,
      customerKey,
      customerLabel,
      ownerId,
      market,
      linkedInvoiceId,
    };
  });
}

function normalizeOpportunities(opportunities: Opportunity[]): NormalizedOpportunity[] {
  return opportunities.map((opportunity) => {
    const stage =
      typeof opportunity.stage === "string" && opportunity.stage.trim()
        ? opportunity.stage
        : "unknown";
    const estimatedValue = parseNumericValue(opportunity.estimatedValue);
    const currency = parseCurrency(opportunity.currency || "UNKNOWN");
    const createdAt = parseDateValue(opportunity.createdAt);
    const ownerId =
      typeof opportunity.assignedToUserId === "string" && opportunity.assignedToUserId.trim()
        ? opportunity.assignedToUserId.trim()
        : null;
    const marketValue = (opportunity as unknown as Record<string, unknown>).market;
    const market =
      typeof marketValue === "string" && marketValue.trim() ? marketValue.trim() : null;

    return {
      id: opportunity.id,
      stage,
      estimatedValue,
      currency,
      createdAt,
      ownerId,
      market,
    };
  });
}

function isOverdueInvoice(invoice: NormalizedInvoice, now: Date): boolean {
  if (invoice.status !== INVOICE_STATUSES.SENT) return false;
  if (!invoice.dueDate) return false;
  return invoice.dueDate.getTime() < startOfDayUTC(now).getTime();
}

function applyInvoiceFilters(
  invoices: NormalizedInvoice[],
  range: BusinessAnalyticsDateRange,
  filters: BusinessAnalyticsFilters,
  now: Date,
): NormalizedInvoice[] {
  return invoices.filter((invoice) => {
    if (!withinRange(invoice.invoiceDate, range)) return false;

    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = filters.statuses.map((x) => x.toLowerCase());
      if (!statuses.includes(invoice.status.toLowerCase())) return false;
    }
    if (filters.customerKeys && filters.customerKeys.length > 0) {
      if (!filters.customerKeys.includes(invoice.customerKey)) return false;
    }
    if (filters.ownerIds && filters.ownerIds.length > 0) {
      if (!invoice.ownerId || !filters.ownerIds.includes(invoice.ownerId)) return false;
    }
    if (filters.currencies && filters.currencies.length > 0) {
      if (!filters.currencies.includes(invoice.currency.toUpperCase())) return false;
    }
    if (filters.markets && filters.markets.length > 0) {
      if (!invoice.market || !filters.markets.includes(invoice.market)) return false;
    }
    if (filters.paymentStates && filters.paymentStates.length > 0) {
      if (!filters.paymentStates.includes(invoice.paymentState.toLowerCase())) return false;
    }
    if (filters.overdueOnly && !isOverdueInvoice(invoice, now)) return false;

    return true;
  });
}

function applyProposalFilters(
  proposals: NormalizedProposal[],
  range: BusinessAnalyticsDateRange,
  filters: BusinessAnalyticsFilters,
): NormalizedProposal[] {
  return proposals.filter((proposal) => {
    if (!withinRange(proposal.createdAt, range)) return false;
    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = filters.statuses.map((x) => x.toUpperCase());
      if (!statuses.includes(proposal.status.toUpperCase())) return false;
    }
    if (filters.customerKeys && filters.customerKeys.length > 0) {
      if (!filters.customerKeys.includes(proposal.customerKey)) return false;
    }
    if (filters.ownerIds && filters.ownerIds.length > 0) {
      if (!proposal.ownerId || !filters.ownerIds.includes(proposal.ownerId)) return false;
    }
    if (filters.currencies && filters.currencies.length > 0) {
      if (!filters.currencies.includes(proposal.currency.toUpperCase())) return false;
    }
    if (filters.markets && filters.markets.length > 0) {
      if (!proposal.market || !filters.markets.includes(proposal.market)) return false;
    }
    return true;
  });
}

function applyOpportunityFilters(
  opportunities: NormalizedOpportunity[],
  range: BusinessAnalyticsDateRange,
  filters: BusinessAnalyticsFilters,
): NormalizedOpportunity[] {
  return opportunities.filter((opportunity) => {
    if (!withinRange(opportunity.createdAt, range)) return false;
    if (filters.ownerIds && filters.ownerIds.length > 0) {
      if (!opportunity.ownerId || !filters.ownerIds.includes(opportunity.ownerId)) return false;
    }
    if (filters.currencies && filters.currencies.length > 0) {
      if (!filters.currencies.includes(opportunity.currency.toUpperCase())) return false;
    }
    if (filters.markets && filters.markets.length > 0) {
      if (!opportunity.market || !filters.markets.includes(opportunity.market)) return false;
    }
    return true;
  });
}

function computeInvoiceTotalsByStatus(
  invoices: NormalizedInvoice[],
): {
  totalInvoiced: CurrencyTotals;
  collected: CurrencyTotals;
  outstanding: CurrencyTotals;
  overdue: CurrencyTotals;
  overdueInvoices: Array<NormalizedInvoice & { daysOverdue: number }>;
} {
  const now = new Date();
  const totalInvoiced: CurrencyTotals = {};
  const collected: CurrencyTotals = {};
  const outstanding: CurrencyTotals = {};
  const overdue: CurrencyTotals = {};
  const overdueInvoices: Array<NormalizedInvoice & { daysOverdue: number }> = [];

  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUSES.SENT || invoice.status === INVOICE_STATUSES.PAID) {
      addToCurrencyTotals(totalInvoiced, invoice.currency, invoice.amount);
    }
    if (invoice.status === INVOICE_STATUSES.PAID) {
      addToCurrencyTotals(collected, invoice.currency, invoice.amount);
    }
    if (invoice.status === INVOICE_STATUSES.SENT) {
      addToCurrencyTotals(outstanding, invoice.currency, invoice.amount);
    }
    if (isOverdueInvoice(invoice, now)) {
      addToCurrencyTotals(overdue, invoice.currency, invoice.amount);
      const dueDate = invoice.dueDate;
      const daysOverdue = dueDate
        ? Math.max(0, Math.floor((startOfDayUTC(now).getTime() - dueDate.getTime()) / DAY_IN_MS))
        : 0;
      overdueInvoices.push({
        ...invoice,
        daysOverdue,
      });
    }
  }

  return {
    totalInvoiced,
    collected,
    outstanding,
    overdue,
    overdueInvoices,
  };
}

function buildBreakdown(
  entries: Array<{
    key: string;
    label: string;
    amount: number;
    currency: string;
  }>,
  limit = 8,
): BusinessAnalyticsBreakdownRow[] {
  const map = new Map<string, BusinessAnalyticsBreakdownRow>();
  for (const entry of entries) {
    if (!entry.key) continue;
    if (!map.has(entry.key)) {
      map.set(entry.key, {
        key: entry.key,
        label: entry.label || entry.key,
        count: 0,
        totalsByCurrency: {},
      });
    }
    const current = map.get(entry.key)!;
    current.count += 1;
    addToCurrencyTotals(current.totalsByCurrency, entry.currency, entry.amount);
  }

  return [...map.values()]
    .sort((a, b) => sumCurrencyTotals(b.totalsByCurrency) - sumCurrencyTotals(a.totalsByCurrency))
    .slice(0, limit);
}

function getTrendValueAtCurrencyMap(
  bucketCount: number,
): Array<CurrencyTotals> {
  return new Array(bucketCount).fill(null).map(() => ({}));
}

function sparklineFromTotals(totals: CurrencyTotals[]): number[] {
  return totals.map((map) => sumCurrencyTotals(map));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function sortRecords(
  records: Array<Record<string, unknown>>,
  sort: BusinessAnalyticsRecordSort,
): Array<Record<string, unknown>> {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    const left = a[sort.field];
    const right = b[sort.field];
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * direction;
    }
    const leftValue = left instanceof Date ? left.getTime() : String(left ?? "");
    const rightValue = right instanceof Date ? right.getTime() : String(right ?? "");
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}

function buildGroupSummary(
  records: Array<Record<string, unknown>>,
  groupBy: string | null,
): Array<{ key: string; count: number; totalsByCurrency: CurrencyTotals }> {
  if (!groupBy) return [];
  const grouped = new Map<string, { key: string; count: number; totalsByCurrency: CurrencyTotals }>();
  for (const record of records) {
    const key = String(record[groupBy] ?? "Unassigned");
    if (!grouped.has(key)) {
      grouped.set(key, { key, count: 0, totalsByCurrency: {} });
    }
    const current = grouped.get(key)!;
    current.count += 1;
    const amount = parseNumericValue(record.amount);
    const currency = parseCurrency(record.currency);
    addToCurrencyTotals(current.totalsByCurrency, currency, amount);
  }
  return [...grouped.values()].sort(
    (a, b) => sumCurrencyTotals(b.totalsByCurrency) - sumCurrencyTotals(a.totalsByCurrency),
  );
}

export class BusinessAnalyticsService {
  constructor(
    private readonly dataset: BusinessAnalyticsDataset,
    private readonly now: Date = new Date(),
  ) {}

  getSummary(payload: BusinessAnalyticsSummaryPayload): BusinessAnalyticsSummaryResponse {
    const normalizedRange = parseAndNormalizeDateRange(payload.dateRange);
    const filters = normalizeFilters(payload.filters);
    const comparePrevious = payload.comparePrevious !== false;
    const comparisonRange = comparePrevious ? previousDateRange(normalizedRange) : null;

    const contactMap = normalizeContactMap(this.dataset.contacts);
    const templateMap = normalizeTemplateMap(this.dataset.templates);
    const userMap = normalizeUserMap(this.dataset.users);

    const normalizedInvoices = normalizeInvoices(
      this.dataset.invoices,
      contactMap,
      templateMap,
    );
    const normalizedProposals = normalizeProposals(this.dataset.proposals, contactMap);
    const normalizedOpportunities = normalizeOpportunities(this.dataset.opportunities);

    const activeInvoices = includeDocumentType(filters, "invoice")
      ? applyInvoiceFilters(normalizedInvoices, normalizedRange, filters, this.now)
      : [];
    const activeProposals = includeDocumentType(filters, "proposal")
      ? applyProposalFilters(normalizedProposals, normalizedRange, filters)
      : [];
    const activeOpportunities = includeDocumentType(filters, "opportunity")
      ? applyOpportunityFilters(normalizedOpportunities, normalizedRange, filters)
      : [];

    const previousInvoices =
      comparisonRange && includeDocumentType(filters, "invoice")
        ? applyInvoiceFilters(normalizedInvoices, comparisonRange, filters, this.now)
        : [];
    const previousProposals =
      comparisonRange && includeDocumentType(filters, "proposal")
        ? applyProposalFilters(normalizedProposals, comparisonRange, filters)
        : [];

    const invoiceTotals = computeInvoiceTotalsByStatus(activeInvoices);
    const previousInvoiceTotals = computeInvoiceTotalsByStatus(previousInvoices);

    const acceptedProposalStatuses: ReadonlySet<string> = new Set([
      PROPOSAL_STATUSES.ACCEPTED,
      PROPOSAL_STATUSES.INVOICED,
    ]);
    const acceptedProposals = activeProposals.filter((proposal) =>
      acceptedProposalStatuses.has(proposal.status),
    );
    const convertedProposals = activeProposals.filter(
      (proposal) => proposal.status === PROPOSAL_STATUSES.INVOICED || Boolean(proposal.linkedInvoiceId),
    );

    const previousAcceptedProposals = previousProposals.filter((proposal) =>
      acceptedProposalStatuses.has(proposal.status),
    );
    const previousConvertedProposals = previousProposals.filter(
      (proposal) => proposal.status === PROPOSAL_STATUSES.INVOICED || Boolean(proposal.linkedInvoiceId),
    );

    const acceptedProposalTotals: CurrencyTotals = {};
    const previousAcceptedProposalTotals: CurrencyTotals = {};

    for (const proposal of acceptedProposals) {
      addToCurrencyTotals(acceptedProposalTotals, proposal.currency, proposal.total);
    }
    for (const proposal of previousAcceptedProposals) {
      addToCurrencyTotals(previousAcceptedProposalTotals, proposal.currency, proposal.total);
    }

    const acceptedCount = acceptedProposals.length;
    const convertedCount = convertedProposals.length;
    const previousAcceptedCount = previousAcceptedProposals.length;
    const previousConvertedCount = previousConvertedProposals.length;

    const conversionRate =
      acceptedCount > 0 ? (convertedCount / acceptedCount) * 100 : 0;
    const previousConversionRate =
      previousAcceptedCount > 0
        ? (previousConvertedCount / previousAcceptedCount) * 100
        : 0;

    const collectionDurationsCurrent: number[] = [];
    const collectionDurationsPrevious: number[] = [];
    let legacyFallbackCountCurrent = 0;

    for (const invoice of activeInvoices) {
      if (invoice.status !== INVOICE_STATUSES.PAID) continue;
      if (!invoice.invoiceDate || !invoice.paidAt) continue;
      const days = Math.max(
        0,
        Math.round((invoice.paidAt.getTime() - invoice.invoiceDate.getTime()) / DAY_IN_MS),
      );
      collectionDurationsCurrent.push(days);
      if (invoice.usedLegacyPaidAtFallback) {
        legacyFallbackCountCurrent += 1;
      }
    }

    for (const invoice of previousInvoices) {
      if (invoice.status !== INVOICE_STATUSES.PAID) continue;
      if (!invoice.invoiceDate || !invoice.paidAt) continue;
      const days = Math.max(
        0,
        Math.round((invoice.paidAt.getTime() - invoice.invoiceDate.getTime()) / DAY_IN_MS),
      );
      collectionDurationsPrevious.push(days);
    }

    const buckets = buildDailyBuckets(normalizedRange);
    const invoicedTrend = getTrendValueAtCurrencyMap(buckets.length);
    const collectedTrend = getTrendValueAtCurrencyMap(buckets.length);
    const outstandingTrend = getTrendValueAtCurrencyMap(buckets.length);
    const overdueTrend = getTrendValueAtCurrencyMap(buckets.length);
    const acceptedProposalTrend = getTrendValueAtCurrencyMap(buckets.length);
    const convertedProposalTrend = getTrendValueAtCurrencyMap(buckets.length);
    const acceptedCountTrend = new Array<number>(buckets.length).fill(0);
    const convertedCountTrend = new Array<number>(buckets.length).fill(0);

    const bucketIndexByDay = new Map<string, number>();
    buckets.forEach((bucket, index) => bucketIndexByDay.set(bucket, index));

    for (const invoice of activeInvoices) {
      if (!invoice.invoiceDate) continue;
      const invoiceDay = toISODate(invoice.invoiceDate);
      const invoiceBucketIndex = bucketIndexByDay.get(invoiceDay);
      if (invoiceBucketIndex === undefined) continue;

      if (invoice.status === INVOICE_STATUSES.SENT || invoice.status === INVOICE_STATUSES.PAID) {
        addToCurrencyTotals(
          invoicedTrend[invoiceBucketIndex],
          invoice.currency,
          invoice.amount,
        );
      }
      if (invoice.status === INVOICE_STATUSES.PAID) {
        addToCurrencyTotals(
          collectedTrend[invoiceBucketIndex],
          invoice.currency,
          invoice.amount,
        );
      }
      if (invoice.status === INVOICE_STATUSES.SENT) {
        addToCurrencyTotals(
          outstandingTrend[invoiceBucketIndex],
          invoice.currency,
          invoice.amount,
        );
      }
      if (
        invoice.status === INVOICE_STATUSES.SENT &&
        invoice.dueDate &&
        invoice.dueDate.getTime() < startOfDayUTC(this.now).getTime()
      ) {
        const dueDay = toISODate(invoice.dueDate);
        const dueIndex = bucketIndexByDay.get(dueDay);
        if (dueIndex !== undefined) {
          addToCurrencyTotals(overdueTrend[dueIndex], invoice.currency, invoice.amount);
        }
      }
    }

    for (const proposal of activeProposals) {
      if (!proposal.createdAt) continue;
      const bucketIndex = bucketIndexByDay.get(toISODate(proposal.createdAt));
      if (bucketIndex === undefined) continue;
      if (acceptedProposalStatuses.has(proposal.status)) {
        addToCurrencyTotals(acceptedProposalTrend[bucketIndex], proposal.currency, proposal.total);
        acceptedCountTrend[bucketIndex] += 1;
      }
      if (proposal.status === PROPOSAL_STATUSES.INVOICED || proposal.linkedInvoiceId) {
        addToCurrencyTotals(convertedProposalTrend[bucketIndex], proposal.currency, proposal.total);
        convertedCountTrend[bucketIndex] += 1;
      }
    }

    const customerBreakdown = buildBreakdown(
      activeInvoices.map((invoice) => ({
        key: invoice.customerKey,
        label: invoice.customerLabel,
        amount: invoice.amount,
        currency: invoice.currency,
      })),
    );

    const ownerBreakdown = buildBreakdown(
      activeInvoices
        .filter((invoice) => invoice.ownerId)
        .map((invoice) => ({
          key: invoice.ownerId as string,
          label: userMap[invoice.ownerId as string] || (invoice.ownerId as string),
          amount: invoice.amount,
          currency: invoice.currency,
        })),
    );

    const statusBreakdown = buildBreakdown(
      activeInvoices.map((invoice) => ({
        key: invoice.status,
        label: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
      })),
      12,
    );

    const currencyBreakdown = buildBreakdown(
      activeInvoices.map((invoice) => ({
        key: invoice.currency,
        label: invoice.currency,
        amount: invoice.amount,
        currency: invoice.currency,
      })),
      12,
    );

    const marketBreakdown = buildBreakdown(
      activeInvoices
        .filter((invoice) => invoice.market)
        .map((invoice) => ({
          key: invoice.market as string,
          label: invoice.market as string,
          amount: invoice.amount,
          currency: invoice.currency,
        })),
    );

    const templateBreakdown = buildBreakdown(
      activeInvoices.map((invoice) => ({
        key: invoice.templateId || "unknown",
        label: invoice.templateLabel,
        amount: invoice.amount,
        currency: invoice.currency,
      })),
    );

    const overdueInvoices = invoiceTotals.overdueInvoices.sort(
      (a, b) => b.amount - a.amount,
    );
    const topOverdueInvoices = overdueInvoices.slice(0, 10).map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerLabel: invoice.customerLabel,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      daysOverdue: invoice.daysOverdue,
      currency: invoice.currency,
      amount: invoice.amount,
    }));

    const topOverdueCustomers = buildBreakdown(
      overdueInvoices.map((invoice) => ({
        key: invoice.customerKey,
        label: invoice.customerLabel,
        amount: invoice.amount,
        currency: invoice.currency,
      })),
      5,
    ).map((item) => ({
      customerKey: item.key,
      customerLabel: item.label,
      invoiceCount: item.count,
      totalsByCurrency: item.totalsByCurrency,
      maxDaysOverdue: overdueInvoices
        .filter((invoice) => invoice.customerKey === item.key)
        .reduce((max, invoice) => Math.max(max, invoice.daysOverdue), 0),
    }));

    const agingBuckets = [
      { key: "0_30", label: "0-30 days", min: 0, max: 30 },
      { key: "31_60", label: "31-60 days", min: 31, max: 60 },
      { key: "61_90", label: "61-90 days", min: 61, max: 90 },
      { key: "90_plus", label: "90+ days", min: 91, max: Number.POSITIVE_INFINITY },
    ].map((bucket) => {
      const matches = overdueInvoices.filter(
        (invoice) =>
          invoice.daysOverdue >= bucket.min &&
          invoice.daysOverdue <= bucket.max,
      );
      const totalsByCurrency: CurrencyTotals = {};
      for (const invoice of matches) {
        addToCurrencyTotals(totalsByCurrency, invoice.currency, invoice.amount);
      }
      return {
        bucket: bucket.key,
        label: bucket.label,
        invoiceCount: matches.length,
        totalsByCurrency,
      };
    });

    const exposureByMarket = buildBreakdown(
      activeInvoices
        .filter(
          (invoice) =>
            invoice.status === INVOICE_STATUSES.SENT && invoice.market,
        )
        .map((invoice) => ({
          key: invoice.market as string,
          label: invoice.market as string,
          amount: invoice.amount,
          currency: invoice.currency,
        })),
    );

    const workflowBottlenecks = [...activeOpportunities]
      .filter((opportunity) => !["won", "lost"].includes(opportunity.stage))
      .reduce<
        Map<string, { stage: string; count: number; estimatedValueByCurrency: CurrencyTotals }>
      >((acc, opportunity) => {
        if (!acc.has(opportunity.stage)) {
          acc.set(opportunity.stage, {
            stage: opportunity.stage,
            count: 0,
            estimatedValueByCurrency: {},
          });
        }
        const current = acc.get(opportunity.stage)!;
        current.count += 1;
        addToCurrencyTotals(
          current.estimatedValueByCurrency,
          opportunity.currency,
          opportunity.estimatedValue,
        );
        return acc;
      }, new Map())
      .values();

    const ownerAvailableCount = activeInvoices.filter((invoice) => Boolean(invoice.ownerId)).length;
    const marketAvailableCount = activeInvoices.filter((invoice) => Boolean(invoice.market)).length;
    const ownerCoveragePct =
      activeInvoices.length > 0
        ? (ownerAvailableCount / activeInvoices.length) * 100
        : 100;
    const marketCoveragePct =
      activeInvoices.length > 0
        ? (marketAvailableCount / activeInvoices.length) * 100
        : 100;

    const caveats: string[] = [];
    if (legacyFallbackCountCurrent > 0) {
      caveats.push(
        `${legacyFallbackCountCurrent} paid invoice(s) were missing paidAt and used updatedAt fallback for collection-time metrics.`,
      );
    }
    if (ownerCoveragePct < 100) {
      caveats.push(
        `Owner attribution is best-effort. ${Math.round(
          100 - ownerCoveragePct,
        )}% of filtered invoices are missing owner mapping.`,
      );
    }
    if (marketCoveragePct < 100) {
      caveats.push(
        `Market attribution is best-effort. ${Math.round(
          100 - marketCoveragePct,
        )}% of filtered invoices are missing market mapping.`,
      );
    }

    return {
      dateRange: normalizedRange,
      comparisonDateRange: comparisonRange,
      filtersApplied: filters,
      kpis: {
        totalInvoiced: {
          totalsByCurrency: invoiceTotals.totalInvoiced,
          previousTotalsByCurrency: previousInvoiceTotals.totalInvoiced,
          deltaPctByCurrency: currencyTotalsDelta(
            invoiceTotals.totalInvoiced,
            previousInvoiceTotals.totalInvoiced,
          ),
          sparkline: sparklineFromTotals(invoicedTrend),
        },
        collectedAmount: {
          totalsByCurrency: invoiceTotals.collected,
          previousTotalsByCurrency: previousInvoiceTotals.collected,
          deltaPctByCurrency: currencyTotalsDelta(
            invoiceTotals.collected,
            previousInvoiceTotals.collected,
          ),
          sparkline: sparklineFromTotals(collectedTrend),
        },
        outstandingAmount: {
          totalsByCurrency: invoiceTotals.outstanding,
          previousTotalsByCurrency: previousInvoiceTotals.outstanding,
          deltaPctByCurrency: currencyTotalsDelta(
            invoiceTotals.outstanding,
            previousInvoiceTotals.outstanding,
          ),
          sparkline: sparklineFromTotals(outstandingTrend),
        },
        overdueAmount: {
          totalsByCurrency: invoiceTotals.overdue,
          previousTotalsByCurrency: previousInvoiceTotals.overdue,
          deltaPctByCurrency: currencyTotalsDelta(
            invoiceTotals.overdue,
            previousInvoiceTotals.overdue,
          ),
          sparkline: sparklineFromTotals(overdueTrend),
        },
        proposalAcceptedValue: {
          totalsByCurrency: acceptedProposalTotals,
          previousTotalsByCurrency: previousAcceptedProposalTotals,
          deltaPctByCurrency: currencyTotalsDelta(
            acceptedProposalTotals,
            previousAcceptedProposalTotals,
          ),
          sparkline: sparklineFromTotals(acceptedProposalTrend),
        },
        proposalToInvoiceConversionRate: {
          value: conversionRate,
          previousValue: previousConversionRate,
          deltaPct: scalarDelta(conversionRate, previousConversionRate),
          sparkline: acceptedCountTrend.map((accepted, index) => {
            const converted = convertedCountTrend[index] || 0;
            return accepted > 0 ? (converted / accepted) * 100 : 0;
          }),
        },
        averageCollectionDays: {
          value: average(collectionDurationsCurrent),
          previousValue: average(collectionDurationsPrevious),
          deltaPct: scalarDelta(
            average(collectionDurationsCurrent),
            average(collectionDurationsPrevious),
          ),
          sparkline: collectionDurationsCurrent.slice(-14),
          sampleSize: collectionDurationsCurrent.length,
          legacyFallbackCount: legacyFallbackCountCurrent,
        },
      },
      trends: {
        invoicedCollected: buckets.map((bucket, index) => ({
          period: bucket,
          invoicedByCurrency: invoicedTrend[index],
          collectedByCurrency: collectedTrend[index],
        })),
        receivables: buckets.map((bucket, index) => ({
          period: bucket,
          outstandingByCurrency: outstandingTrend[index],
          overdueByCurrency: overdueTrend[index],
        })),
        proposalFlow: buckets.map((bucket, index) => ({
          period: bucket,
          acceptedValueByCurrency: acceptedProposalTrend[index],
          invoicedValueByCurrency: convertedProposalTrend[index],
          acceptedCount: acceptedCountTrend[index],
          invoicedCount: convertedCountTrend[index],
        })),
      },
      breakdowns: {
        customers: customerBreakdown,
        owners: ownerBreakdown,
        statuses: statusBreakdown,
        currencies: currencyBreakdown,
        markets: marketBreakdown,
        templates: templateBreakdown,
      },
      risk: {
        agingBuckets,
        topOverdueCustomers,
        topOverdueInvoices,
        exposureByMarket,
        workflowBottlenecks: [...workflowBottlenecks].sort((a, b) => b.count - a.count),
      },
      trust: {
        lastUpdatedAt: new Date().toISOString(),
        metricDefinitions: {
          totalInvoiced: {
            includes: "Invoices with status sent or paid.",
            excludes: "Unsent and cancelled invoices.",
            formula: "Sum(invoice.total) where status in [sent, paid].",
            timeBasis: "invoiceDate || issueDate || createdAt.",
            currencyBasis: "Per-currency totals; no FX conversion.",
          },
          collectedAmount: {
            includes: "Invoices with status paid.",
            excludes: "Unsent, sent, and cancelled invoices.",
            formula: "Sum(invoice.total) where status = paid.",
            timeBasis: "invoiceDate || issueDate || createdAt.",
            currencyBasis: "Per-currency totals; no FX conversion.",
          },
          outstandingAmount: {
            includes: "Invoices with status sent.",
            excludes: "Unsent, paid, and cancelled invoices.",
            formula: "Sum(invoice.total) where status = sent.",
            timeBasis: "invoiceDate || issueDate || createdAt.",
            currencyBasis: "Per-currency totals; no FX conversion.",
          },
          overdueAmount: {
            includes: "Invoices with status sent and dueDate before today.",
            excludes: "Paid, cancelled, unsent, and sent invoices without dueDate.",
            formula: "Sum(invoice.total) where status=sent and dueDate < today.",
            timeBasis: "invoiceDate || issueDate || createdAt; dueDate for overdue check.",
            currencyBasis: "Per-currency totals; no FX conversion.",
          },
          proposalAcceptedValue: {
            includes: "Proposals with status ACCEPTED or INVOICED.",
            excludes: "CREATED, SENT, REJECTED, EXPIRED proposals.",
            formula: "Sum(proposal.total) where status in [ACCEPTED, INVOICED].",
            timeBasis: "proposal.createdAt.",
            currencyBasis: "Per-currency totals; no FX conversion.",
          },
          proposalToInvoiceConversionRate: {
            includes: "Accepted and converted proposals in selected period.",
            excludes: "Proposals outside selected period.",
            formula: "(converted proposals / accepted proposals) * 100.",
            timeBasis: "proposal.createdAt.",
            currencyBasis: "Rate metric; currency not applicable.",
          },
          averageCollectionDays: {
            includes: "Paid invoices with invoice date and paidAt (or legacy fallback).",
            excludes: "Unpaid invoices or paid invoices without usable dates.",
            formula: "Average(days between invoice date and paidAt).",
            timeBasis: "invoiceDate || issueDate || createdAt and paidAt (fallback updatedAt).",
            currencyBasis: "Duration metric; currency not applicable.",
          },
        },
        caveats,
        ownerDerivationCoveragePct: ownerCoveragePct,
        marketDerivationCoveragePct: marketCoveragePct,
      },
    };
  }

  getRecords(payload: BusinessAnalyticsRecordsPayload): BusinessAnalyticsRecordsResponse {
    const normalizedRange = parseAndNormalizeDateRange(payload.dateRange);
    const filters = normalizeFilters(payload.filters);
    const sort = payload.sort || DEFAULT_SORT;
    const groupBy = payload.groupBy || null;
    const pageSize = Math.max(1, Math.min(250, payload.pageSize || DEFAULT_PAGE_SIZE));
    const page = Math.max(1, payload.page || 1);

    const contactMap = normalizeContactMap(this.dataset.contacts);
    const templateMap = normalizeTemplateMap(this.dataset.templates);
    const userMap = normalizeUserMap(this.dataset.users);

    const normalizedInvoices = normalizeInvoices(
      this.dataset.invoices,
      contactMap,
      templateMap,
    );
    const normalizedProposals = normalizeProposals(this.dataset.proposals, contactMap);

    const activeInvoices = applyInvoiceFilters(
      normalizedInvoices,
      normalizedRange,
      filters,
      this.now,
    );
    const activeProposals = applyProposalFilters(
      normalizedProposals,
      normalizedRange,
      filters,
    );

    const caveats: string[] = [];
    const totalsByCurrency: CurrencyTotals = {};
    let records: Array<Record<string, unknown>> = [];

    if (payload.tab === "documents") {
      records = activeInvoices.map((invoice) => {
        addToCurrencyTotals(totalsByCurrency, invoice.currency, invoice.amount);
        const isOverdue = isOverdueInvoice(invoice, this.now);
        const daysOverdue =
          isOverdue && invoice.dueDate
            ? Math.max(
                0,
                Math.floor((startOfDayUTC(this.now).getTime() - invoice.dueDate.getTime()) / DAY_IN_MS),
              )
            : 0;
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customerLabel,
          customerKey: invoice.customerKey,
          owner: invoice.ownerId ? userMap[invoice.ownerId] || invoice.ownerId : "Unassigned",
          ownerId: invoice.ownerId || "",
          status: invoice.status,
          amount: invoice.amount,
          currency: invoice.currency,
          date: invoice.invoiceDate ? invoice.invoiceDate.toISOString() : null,
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
          daysOverdue,
          market: invoice.market || "Unknown",
          template: invoice.templateLabel,
          templateId: invoice.templateId || "",
        };
      });
    } else if (payload.tab === "customers") {
      const customerMap = new Map<
        string,
        {
          customer: string;
          customerKey: string;
          invoiceCount: number;
          invoicedByCurrency: CurrencyTotals;
          collectedByCurrency: CurrencyTotals;
          outstandingByCurrency: CurrencyTotals;
          overdueByCurrency: CurrencyTotals;
          primaryOwner: string;
          market: string;
        }
      >();

      for (const invoice of activeInvoices) {
        if (!customerMap.has(invoice.customerKey)) {
          customerMap.set(invoice.customerKey, {
            customer: invoice.customerLabel,
            customerKey: invoice.customerKey,
            invoiceCount: 0,
            invoicedByCurrency: {},
            collectedByCurrency: {},
            outstandingByCurrency: {},
            overdueByCurrency: {},
            primaryOwner: invoice.ownerId
              ? userMap[invoice.ownerId] || invoice.ownerId
              : "Unassigned",
            market: invoice.market || "Unknown",
          });
        }
        const row = customerMap.get(invoice.customerKey)!;
        row.invoiceCount += 1;
        if (invoice.status === INVOICE_STATUSES.SENT || invoice.status === INVOICE_STATUSES.PAID) {
          addToCurrencyTotals(row.invoicedByCurrency, invoice.currency, invoice.amount);
          addToCurrencyTotals(totalsByCurrency, invoice.currency, invoice.amount);
        }
        if (invoice.status === INVOICE_STATUSES.PAID) {
          addToCurrencyTotals(row.collectedByCurrency, invoice.currency, invoice.amount);
        }
        if (invoice.status === INVOICE_STATUSES.SENT) {
          addToCurrencyTotals(row.outstandingByCurrency, invoice.currency, invoice.amount);
          if (isOverdueInvoice(invoice, this.now)) {
            addToCurrencyTotals(row.overdueByCurrency, invoice.currency, invoice.amount);
          }
        }
      }

      records = [...customerMap.values()].map((row) => ({
        ...row,
        amount: sumCurrencyTotals(row.invoicedByCurrency),
        currency: Object.keys(row.invoicedByCurrency)[0] || "MIXED",
      }));
    } else if (payload.tab === "proposals") {
      records = activeProposals.map((proposal) => {
        addToCurrencyTotals(totalsByCurrency, proposal.currency, proposal.total);
        return {
          id: proposal.id,
          title: proposal.customerLabel,
          status: proposal.status,
          amount: proposal.total,
          currency: proposal.currency,
          date: proposal.createdAt ? proposal.createdAt.toISOString() : null,
          customer: proposal.customerLabel,
          customerKey: proposal.customerKey,
          owner: proposal.ownerId ? userMap[proposal.ownerId] || proposal.ownerId : "Unassigned",
          ownerId: proposal.ownerId || "",
          market: proposal.market || "Unknown",
          linkedInvoiceId: proposal.linkedInvoiceId || "",
        };
      });
    } else {
      // collections tab
      records = activeInvoices
        .filter((invoice) => invoice.status === INVOICE_STATUSES.PAID)
        .map((invoice) => {
          addToCurrencyTotals(totalsByCurrency, invoice.currency, invoice.amount);
          const collectionDays =
            invoice.invoiceDate && invoice.paidAt
              ? Math.max(
                  0,
                  Math.round((invoice.paidAt.getTime() - invoice.invoiceDate.getTime()) / DAY_IN_MS),
                )
              : null;
          const paymentDelayDays =
            invoice.dueDate && invoice.paidAt
              ? Math.max(
                  0,
                  Math.round((invoice.paidAt.getTime() - invoice.dueDate.getTime()) / DAY_IN_MS),
                )
              : null;
          if (invoice.usedLegacyPaidAtFallback) {
            caveats.push(
              `Invoice ${invoice.invoiceNumber} uses updatedAt fallback because paidAt is missing.`,
            );
          }
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customer: invoice.customerLabel,
            owner: invoice.ownerId ? userMap[invoice.ownerId] || invoice.ownerId : "Unassigned",
            status: invoice.status,
            amount: invoice.amount,
            currency: invoice.currency,
            invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.toISOString() : null,
            dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
            paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
            collectionDays,
            paymentDelayDays,
            market: invoice.market || "Unknown",
            date: invoice.invoiceDate ? invoice.invoiceDate.toISOString() : null,
          };
        });
    }

    const sorted = sortRecords(records, sort);
    const groups = buildGroupSummary(sorted, groupBy);
    const totalCount = sorted.length;
    const offset = (page - 1) * pageSize;
    const pageRecords = sorted.slice(offset, offset + pageSize);

    return {
      tab: payload.tab,
      page,
      pageSize,
      totalCount,
      totalsByCurrency,
      groups,
      records: pageRecords,
      sort,
      groupBy,
      lastUpdatedAt: new Date().toISOString(),
      caveats: [...new Set(caveats)].slice(0, 20),
    };
  }
}
