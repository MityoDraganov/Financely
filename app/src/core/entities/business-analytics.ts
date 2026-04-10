export interface BusinessAnalyticsDateRange {
  start: string;
  end: string;
}

export interface BusinessAnalyticsFilters {
  documentTypes?: string[];
  statuses?: string[];
  customerKeys?: string[];
  ownerIds?: string[];
  currencies?: string[];
  markets?: string[];
  paymentStates?: string[];
  overdueOnly?: boolean;
}

export interface BusinessAnalyticsSummaryPayload {
  orgId: string;
  dateRange: BusinessAnalyticsDateRange;
  comparePrevious?: boolean;
  filters?: BusinessAnalyticsFilters;
}

export interface BusinessAnalyticsRecordSort {
  field: string;
  direction: "asc" | "desc";
}

export interface BusinessAnalyticsRecordsPayload
  extends BusinessAnalyticsSummaryPayload {
  tab: "documents" | "customers" | "proposals" | "collections";
  sort?: BusinessAnalyticsRecordSort;
  groupBy?: string | null;
  page?: number;
  pageSize?: number;
}

export interface BusinessAnalyticsMetricDefinition {
  includes: string;
  excludes: string;
  formula: string;
  timeBasis: string;
  currencyBasis: string;
}

export type CurrencyTotals = Record<string, number>;
export type CurrencyDelta = Record<string, number | null>;

export interface BusinessAnalyticsCurrencyKpi {
  totalsByCurrency: CurrencyTotals;
  previousTotalsByCurrency: CurrencyTotals;
  deltaPctByCurrency: CurrencyDelta;
  sparkline: number[];
}

export interface BusinessAnalyticsScalarKpi {
  value: number | null;
  previousValue: number | null;
  deltaPct: number | null;
  sparkline: number[];
}

export interface BusinessAnalyticsBreakdownRow {
  key: string;
  label: string;
  count: number;
  totalsByCurrency: CurrencyTotals;
}

export interface BusinessAnalyticsSummaryResponse {
  dateRange: BusinessAnalyticsDateRange;
  comparisonDateRange: BusinessAnalyticsDateRange | null;
  filtersApplied: BusinessAnalyticsFilters;
  kpis: {
    totalInvoiced: BusinessAnalyticsCurrencyKpi;
    collectedAmount: BusinessAnalyticsCurrencyKpi;
    outstandingAmount: BusinessAnalyticsCurrencyKpi;
    overdueAmount: BusinessAnalyticsCurrencyKpi;
    proposalAcceptedValue: BusinessAnalyticsCurrencyKpi;
    proposalToInvoiceConversionRate: BusinessAnalyticsScalarKpi;
    averageCollectionDays: BusinessAnalyticsScalarKpi & {
      sampleSize: number;
      legacyFallbackCount: number;
    };
  };
  trends: {
    invoicedCollected: Array<{
      period: string;
      invoicedByCurrency: CurrencyTotals;
      collectedByCurrency: CurrencyTotals;
    }>;
    receivables: Array<{
      period: string;
      outstandingByCurrency: CurrencyTotals;
      overdueByCurrency: CurrencyTotals;
    }>;
    proposalFlow: Array<{
      period: string;
      acceptedValueByCurrency: CurrencyTotals;
      invoicedValueByCurrency: CurrencyTotals;
      acceptedCount: number;
      invoicedCount: number;
    }>;
  };
  breakdowns: {
    customers: BusinessAnalyticsBreakdownRow[];
    owners: BusinessAnalyticsBreakdownRow[];
    statuses: BusinessAnalyticsBreakdownRow[];
    currencies: BusinessAnalyticsBreakdownRow[];
    markets: BusinessAnalyticsBreakdownRow[];
    templates: BusinessAnalyticsBreakdownRow[];
  };
  risk: {
    agingBuckets: Array<{
      bucket: string;
      label: string;
      invoiceCount: number;
      totalsByCurrency: CurrencyTotals;
    }>;
    topOverdueCustomers: Array<{
      customerKey: string;
      customerLabel: string;
      invoiceCount: number;
      totalsByCurrency: CurrencyTotals;
      maxDaysOverdue: number;
    }>;
    topOverdueInvoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      customerLabel: string;
      dueDate: string | null;
      daysOverdue: number;
      currency: string;
      amount: number;
    }>;
    exposureByMarket: BusinessAnalyticsBreakdownRow[];
    workflowBottlenecks: Array<{
      stage: string;
      count: number;
      estimatedValueByCurrency: CurrencyTotals;
    }>;
  };
  trust: {
    lastUpdatedAt: string;
    metricDefinitions: Record<string, BusinessAnalyticsMetricDefinition>;
    caveats: string[];
    ownerDerivationCoveragePct: number;
    marketDerivationCoveragePct: number;
  };
}

export interface BusinessAnalyticsRecordsResponse {
  tab: "documents" | "customers" | "proposals" | "collections";
  page: number;
  pageSize: number;
  totalCount: number;
  totalsByCurrency: CurrencyTotals;
  groups: Array<{
    key: string;
    count: number;
    totalsByCurrency: CurrencyTotals;
  }>;
  records: Array<Record<string, unknown>>;
  sort: BusinessAnalyticsRecordSort;
  groupBy: string | null;
  lastUpdatedAt: string;
  caveats: string[];
}
