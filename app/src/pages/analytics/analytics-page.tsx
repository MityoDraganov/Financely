import { Link } from "react-router-dom";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useOrganizations } from "@/hooks/repository-hooks/use-organizations";
import {
  useAnalyticsViews,
  useCreateAnalyticsView,
  useDeleteAnalyticsView,
  useUpdateAnalyticsView,
} from "@/hooks/repository-hooks/use-analytics-views";
import {
  useBusinessAnalyticsRecords,
  useBusinessAnalyticsSummary,
} from "@/hooks/service-hooks/use-business-analytics";
import {
  BusinessAnalyticsBreakdownRow,
  BusinessAnalyticsCurrencyKpi,
  BusinessAnalyticsScalarKpi,
  BusinessAnalyticsSummaryPayload,
  CurrencyTotals,
} from "@/core";
import {
  analyticsReducer,
  buildAnalyticsExportPayload,
  buildAnalyticsRecordsPayload,
  buildAnalyticsViewPayload,
  buildFilterPills,
  DEFAULT_ANALYTICS_STATE,
} from "@/pages/analytics/analytics-state";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  Loader2,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TrendPoint = { period: string; [key: string]: string | number };

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatCurrencyMap(
  totals: CurrencyTotals,
  opts: {
    empty?: string;
  } = {},
): string {
  const entries = Object.entries(totals || {});
  if (entries.length === 0) {
    return opts.empty || "-";
  }
  return entries
    .map(([currency, amount]) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        return `${currency} ${amount.toLocaleString("en-US")}`;
      }
    })
    .join(" · ");
}

function statusTone(status: string): string {
  const value = status.toLowerCase();
  if (value.includes("paid") || value.includes("collected") || value.includes("accepted")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (value.includes("overdue") || value.includes("rejected") || value.includes("cancel")) {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (value.includes("sent") || value.includes("outstanding") || value.includes("invoiced")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function sparklinePath(points: number[], width = 90, height = 28): string {
  if (!points.length) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function KpiCurrencyCard({
  title,
  kpi,
  tone,
  onClick,
}: {
  title: string;
  kpi: BusinessAnalyticsCurrencyKpi;
  tone: "healthy" | "warning" | "risk" | "neutral";
  onClick: () => void;
}) {
  const toneClass =
    tone === "healthy"
      ? "border-emerald-200"
      : tone === "warning"
        ? "border-amber-200"
        : tone === "risk"
          ? "border-rose-200"
          : "border-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border bg-white p-4 text-left transition hover:shadow-sm ${toneClass}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">
        {formatCurrencyMap(kpi.totalsByCurrency)}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {formatCurrencyMap(kpi.previousTotalsByCurrency, { empty: "No previous period data" })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-slate-600">Δ {formatDeltaMap(kpi.deltaPctByCurrency)}</div>
        <svg viewBox="0 0 90 28" className="h-7 w-[90px]">
          <path d={sparklinePath(kpi.sparkline || [])} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-700" />
        </svg>
      </div>
    </button>
  );
}

function KpiScalarCard({
  title,
  value,
  delta,
  suffix,
  sample,
  onClick,
}: {
  title: string;
  value: number | null;
  delta: number | null;
  suffix?: string;
  sample?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:shadow-sm"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">
        {value === null ? "-" : `${value.toFixed(1)}${suffix || ""}`}
      </div>
      <div className="mt-1 text-xs text-slate-600">Δ {formatDelta(delta)}</div>
      {sample ? <div className="mt-2 text-xs text-slate-500">{sample}</div> : null}
    </button>
  );
}

function formatDelta(delta: number | null): string {
  if (delta === null || Number.isNaN(delta)) return "n/a";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function formatDeltaMap(deltaMap: Record<string, number | null>): string {
  const entries = Object.entries(deltaMap || {});
  if (entries.length === 0) return "n/a";
  return entries
    .map(([currency, delta]) => `${currency}: ${formatDelta(delta)}`)
    .join(" · ");
}

function toCsv(records: Array<Record<string, unknown>>): string {
  if (!records.length) return "";
  const headers = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (text.includes(",") || text.includes("\n") || text.includes('"')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.join(",")];
  for (const row of records) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}

function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function mapBreakdownLabel(kind: string): string {
  if (kind === "customers") return "Customer";
  if (kind === "owners") return "Owner";
  if (kind === "statuses") return "Status";
  if (kind === "currencies") return "Currency";
  if (kind === "markets") return "Market";
  return "Template";
}

function buildTrendData(
  selectedCurrency: string,
  summary: ReturnType<typeof useBusinessAnalyticsSummary>["data"],
): {
  invoicedCollected: TrendPoint[];
  receivables: TrendPoint[];
  proposalFlow: TrendPoint[];
} {
  if (!summary) {
    return {
      invoicedCollected: [],
      receivables: [],
      proposalFlow: [],
    };
  }

  return {
    invoicedCollected: summary.trends.invoicedCollected.map((point) => ({
      period: point.period,
      invoiced: point.invoicedByCurrency[selectedCurrency] || 0,
      collected: point.collectedByCurrency[selectedCurrency] || 0,
    })),
    receivables: summary.trends.receivables.map((point) => ({
      period: point.period,
      outstanding: point.outstandingByCurrency[selectedCurrency] || 0,
      overdue: point.overdueByCurrency[selectedCurrency] || 0,
    })),
    proposalFlow: summary.trends.proposalFlow.map((point) => ({
      period: point.period,
      acceptedValue: point.acceptedValueByCurrency[selectedCurrency] || 0,
      invoicedValue: point.invoicedValueByCurrency[selectedCurrency] || 0,
      acceptedCount: point.acceptedCount,
      invoicedCount: point.invoicedCount,
    })),
  };
}

function breakdownRows(rows: BusinessAnalyticsBreakdownRow[], maxRows = 8): BusinessAnalyticsBreakdownRow[] {
  return rows.slice(0, maxRows);
}

export default function AnalyticsPage() {
  const { data: currentOrg, isLoading: currentOrgLoading } = useCurrentOrganization();
  const { data: organizations = [] } = useOrganizations();
  const { formatDateShort } = useDateFormatting();

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [dateRange, setDateRange] = useState(getDefaultRange());
  const [comparePrevious, setComparePrevious] = useState(true);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState<string>("none");

  const [state, dispatch] = useReducer(analyticsReducer, DEFAULT_ANALYTICS_STATE);

  useEffect(() => {
    if (currentOrg?.id && !selectedOrgId) {
      setSelectedOrgId(currentOrg.id);
    }
  }, [currentOrg?.id, selectedOrgId]);

  const summaryPayload: BusinessAnalyticsSummaryPayload | null = selectedOrgId
    ? {
        orgId: selectedOrgId,
        dateRange,
        comparePrevious,
        filters: state.filters,
      }
    : null;

  const summaryQuery = useBusinessAnalyticsSummary(summaryPayload);
  const recordsPayload = summaryPayload
    ? buildAnalyticsRecordsPayload(summaryPayload, state)
    : null;
  const recordsQuery = useBusinessAnalyticsRecords(recordsPayload);

  const analyticsViewsQuery = useAnalyticsViews(selectedOrgId || undefined);
  const createView = useCreateAnalyticsView(selectedOrgId || undefined);
  const updateView = useUpdateAnalyticsView(selectedOrgId || undefined);
  const deleteView = useDeleteAnalyticsView(selectedOrgId || undefined);

  const summary = summaryQuery.data;
  const records = recordsQuery.data;
  const views = analyticsViewsQuery.data || [];

  const selectedCurrency = useMemo(() => {
    const explicit = state.filters.currencies?.[0];
    if (explicit) return explicit;

    const kpiCurrencies = Object.keys(summary?.kpis.totalInvoiced.totalsByCurrency || {});
    return kpiCurrencies[0] || "USD";
  }, [state.filters.currencies, summary?.kpis.totalInvoiced.totalsByCurrency]);

  const trendData = useMemo(
    () => buildTrendData(selectedCurrency, summary),
    [selectedCurrency, summary],
  );

  const pills = useMemo(() => buildFilterPills(state.filters), [state.filters]);

  const isLoading =
    currentOrgLoading ||
    (summaryPayload !== null && (summaryQuery.isLoading || recordsQuery.isLoading));

  const hasLowData = Boolean(summary) && records?.totalCount !== undefined && records.totalCount < 5;

  const filterOptions = useMemo(() => {
    const fromRows = (rows: BusinessAnalyticsBreakdownRow[]) =>
      rows.map((row) => ({ value: row.key, label: row.label }));

    return {
      statuses: fromRows(summary?.breakdowns.statuses || []),
      customers: fromRows(summary?.breakdowns.customers || []),
      owners: fromRows(summary?.breakdowns.owners || []),
      currencies: fromRows(summary?.breakdowns.currencies || []),
      markets: fromRows(summary?.breakdowns.markets || []),
      paymentStates: [
        { value: "paid", label: "Paid" },
        { value: "outstanding", label: "Outstanding" },
        { value: "overdue", label: "Overdue" },
      ],
      documentTypes: [
        { value: "invoice", label: "Invoice" },
        { value: "proposal", label: "Proposal" },
        { value: "opportunity", label: "Opportunity" },
      ],
    };
  }, [summary]);

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  };

  const handlePillRemove = (pillKey: string, value: string) => {
    if (pillKey === "overdueOnly") {
      dispatch({ type: "set_overdue_only", value: false });
      return;
    }

    dispatch({
      type: "remove_filter_value",
      key: pillKey as
        | "documentTypes"
        | "statuses"
        | "customerKeys"
        | "ownerIds"
        | "currencies"
        | "markets"
        | "paymentStates",
      value,
    });
  };

  const handleExportRows = () => {
    if (!records?.records?.length) {
      toast.error("No records available to export");
      return;
    }
    const csv = toCsv(records.records);
    downloadFile(
      `analytics-${state.table.tab}-${dateRange.start}-to-${dateRange.end}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
    toast.success("Current records exported");
  };

  const handleExportConfig = () => {
    if (!summaryPayload) return;
    const payload = buildAnalyticsExportPayload(summaryPayload, state);
    downloadFile(
      `analytics-view-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("Filter and table config exported");
  };

  const handleSaveView = async () => {
    const trimmed = viewName.trim();
    if (!trimmed) {
      toast.error("Enter a view name");
      return;
    }

    const payload = buildAnalyticsViewPayload(state);

    try {
      await createView.mutateAsync({
        name: trimmed,
        filters: {
          ...payload.filters,
          dateRange,
          comparePrevious,
        },
        tableConfig: payload.tableConfig,
      });
      setViewName("");
      toast.success("Saved view created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save view");
    }
  };

  const handleUpdateView = async () => {
    if (!selectedViewId || selectedViewId === "none") {
      toast.error("Select a saved view first");
      return;
    }
    const payload = buildAnalyticsViewPayload(state);
    try {
      await updateView.mutateAsync({
        id: selectedViewId,
        data: {
          filters: {
            ...payload.filters,
            dateRange,
            comparePrevious,
          },
          tableConfig: payload.tableConfig,
        },
      });
      toast.success("Saved view updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update view");
    }
  };

  const handleDeleteView = async () => {
    if (!selectedViewId || selectedViewId === "none") {
      toast.error("Select a saved view first");
      return;
    }
    try {
      await deleteView.mutateAsync(selectedViewId);
      setSelectedViewId("none");
      toast.success("Saved view deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete view");
    }
  };

  const handleApplySavedView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (viewId === "none") return;

    const view = views.find((item) => item.id === viewId);
    if (!view) return;

    dispatch({
      type: "apply_saved_view",
      filters: view.filters,
      tableConfig: view.tableConfig,
    });

    if (view.filters.dateRange) {
      setDateRange(view.filters.dateRange);
    }
    if (typeof view.filters.comparePrevious === "boolean") {
      setComparePrevious(view.filters.comparePrevious);
    }

    toast.success(`Applied view: ${view.name}`);
  };

  const tableColumns = useMemo(() => {
    const first = records?.records?.[0];
    return first ? Object.keys(first) : [];
  }, [records?.records]);

  const activeTab = state.table.tab;
  const totalPages = records ? Math.max(1, Math.ceil(records.totalCount / records.pageSize)) : 1;

  return (
    <div className="min-h-full bg-[#f7f9fc] px-4 pb-8 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business Analytics</h1>
              <p className="mt-1 text-sm text-slate-600">
                Commercial-to-cash control surface: proposals, invoicing, receivables, and collection performance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportConfig}>
                <Download className="mr-2 h-4 w-4" />
                Export config
              </Button>
              <Button size="sm" onClick={handleExportRows}>
                <Download className="mr-2 h-4 w-4" />
                Export rows
              </Button>
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1 xl:col-span-2">
              <Label>Organization</Label>
              <Select value={selectedOrgId || ""} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Date start</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
                max={dateRange.end}
              />
            </div>

            <div className="space-y-1">
              <Label>Date end</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
                min={dateRange.start}
                max={getTodayIso()}
              />
            </div>

            <div className="space-y-1">
              <Label>Saved views</Label>
              <Select value={selectedViewId} onValueChange={handleApplySavedView}>
                <SelectTrigger>
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No saved view</SelectItem>
                  {views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3">
                <Switch checked={comparePrevious} onCheckedChange={setComparePrevious} id="comparePrevious" />
                <Label htmlFor="comparePrevious" className="cursor-pointer text-xs">Compare previous</Label>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuickRange(7)}>
              <Calendar className="mr-2 h-4 w-4" />7D
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickRange(30)}>
              <Calendar className="mr-2 h-4 w-4" />30D
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickRange(90)}>
              <Calendar className="mr-2 h-4 w-4" />90D
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Input
              className="h-9 w-[220px]"
              placeholder="Save current view as..."
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <Button size="sm" variant="outline" onClick={handleSaveView}>
              <Save className="mr-2 h-4 w-4" />Save view
            </Button>
            <Button size="sm" variant="outline" onClick={handleUpdateView}>
              Update selected
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeleteView}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>

            <div className="ml-auto text-xs text-slate-500">
              Last updated: {summary?.trust.lastUpdatedAt ? formatDateShort(new Date(summary.trust.lastUpdatedAt)) : "-"}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="space-y-1">
              <Label>Document type</Label>
              <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "documentTypes", value })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {filterOptions.documentTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "statuses", value })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {filterOptions.statuses.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Customer</Label>
              <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "customerKeys", value })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {filterOptions.customers.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Owner</Label>
              <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "ownerIds", value })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {filterOptions.owners.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Currency / market</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "currencies", value })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Currency" /></SelectTrigger>
                  <SelectContent>
                    {filterOptions.currencies.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "markets", value })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Market" /></SelectTrigger>
                  <SelectContent>
                    {filterOptions.markets.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment state</Label>
              <Select onValueChange={(value) => dispatch({ type: "add_filter_value", key: "paymentStates", value })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {filterOptions.paymentStates.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 px-3">
                <span className="text-xs text-slate-600">Overdue only</span>
                <Switch
                  checked={Boolean(state.filters.overdueOnly)}
                  onCheckedChange={(checked) => dispatch({ type: "set_overdue_only", value: checked })}
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="h-9 w-full"
                onClick={() => dispatch({ type: "clear_filters" })}
              >
                <Filter className="mr-2 h-4 w-4" />Clear filters
              </Button>
            </div>
          </div>

          {pills.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {pills.map((pill) => (
                <Badge
                  key={`${pill.key}:${pill.value}`}
                  variant="outline"
                  className="cursor-pointer border-slate-300 bg-slate-50 text-slate-700"
                  onClick={() => handlePillRemove(pill.key, pill.value)}
                >
                  {pill.label} ×
                </Badge>
              ))}
            </div>
          ) : null}
        </section>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
          </div>
        ) : null}

        {!isLoading && summary && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCurrencyCard
                title="Total invoiced"
                kpi={summary.kpis.totalInvoiced}
                tone="neutral"
                onClick={() => dispatch({ type: "set_filter_array", key: "statuses", values: ["sent", "paid"] })}
              />
              <KpiCurrencyCard
                title="Collected"
                kpi={summary.kpis.collectedAmount}
                tone="healthy"
                onClick={() => dispatch({ type: "set_filter_array", key: "statuses", values: ["paid"] })}
              />
              <KpiCurrencyCard
                title="Outstanding"
                kpi={summary.kpis.outstandingAmount}
                tone="warning"
                onClick={() => dispatch({ type: "set_filter_array", key: "statuses", values: ["sent"] })}
              />
              <KpiCurrencyCard
                title="Overdue"
                kpi={summary.kpis.overdueAmount}
                tone="risk"
                onClick={() => {
                  dispatch({ type: "set_filter_array", key: "statuses", values: ["sent"] });
                  dispatch({ type: "set_overdue_only", value: true });
                }}
              />
              <KpiCurrencyCard
                title="Proposal accepted value"
                kpi={summary.kpis.proposalAcceptedValue}
                tone="neutral"
                onClick={() => dispatch({ type: "set_filter_array", key: "documentTypes", values: ["proposal"] })}
              />
              <KpiScalarCard
                title="Proposal → invoice conversion"
                value={summary.kpis.proposalToInvoiceConversionRate.value}
                delta={summary.kpis.proposalToInvoiceConversionRate.deltaPct}
                suffix="%"
                onClick={() => dispatch({ type: "set_tab", tab: "proposals" })}
              />
              <KpiScalarCard
                title="Average collection days"
                value={summary.kpis.averageCollectionDays.value}
                delta={summary.kpis.averageCollectionDays.deltaPct}
                suffix=" d"
                sample={`Sample ${summary.kpis.averageCollectionDays.sampleSize}`}
                onClick={() => dispatch({ type: "set_tab", tab: "collections" })}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Trend section ({selectedCurrency})</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="h-56 rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-700">Invoiced vs collected</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={trendData.invoicedCollected}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line dataKey="invoiced" type="monotone" stroke="#0f172a" dot={false} strokeWidth={2} />
                        <Line dataKey="collected" type="monotone" stroke="#16a34a" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56 rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-700">Outstanding vs overdue</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={trendData.receivables}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line dataKey="outstanding" type="monotone" stroke="#f59e0b" dot={false} strokeWidth={2} />
                        <Line dataKey="overdue" type="monotone" stroke="#e11d48" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56 rounded-lg border border-slate-200 p-3 lg:col-span-2">
                    <div className="mb-2 text-sm font-medium text-slate-700">Proposal flow value</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={trendData.proposalFlow}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line dataKey="acceptedValue" type="monotone" stroke="#1d4ed8" dot={false} strokeWidth={2} />
                        <Line dataKey="invoicedValue" type="monotone" stroke="#16a34a" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Breakdowns</h2>
                <div className="mt-3 space-y-3">
                  {([
                    ["customers", summary.breakdowns.customers],
                    ["owners", summary.breakdowns.owners],
                    ["statuses", summary.breakdowns.statuses],
                    ["currencies", summary.breakdowns.currencies],
                    ["markets", summary.breakdowns.markets],
                    ["templates", summary.breakdowns.templates],
                  ] as const).map(([kind, rows]) => (
                    <div key={kind} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {mapBreakdownLabel(kind)}
                      </div>
                      <div className="space-y-1">
                        {breakdownRows(rows, 4).map((row) => (
                          <button
                            type="button"
                            key={`${kind}:${row.key}`}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-slate-50"
                            onClick={() => {
                              if (kind === "customers") {
                                dispatch({ type: "add_filter_value", key: "customerKeys", value: row.key });
                              } else if (kind === "owners") {
                                dispatch({ type: "add_filter_value", key: "ownerIds", value: row.key });
                              } else if (kind === "statuses") {
                                dispatch({ type: "add_filter_value", key: "statuses", value: row.key });
                              } else if (kind === "currencies") {
                                dispatch({ type: "add_filter_value", key: "currencies", value: row.key });
                              } else if (kind === "markets") {
                                dispatch({ type: "add_filter_value", key: "markets", value: row.key });
                              }
                            }}
                          >
                            <span className="truncate text-xs text-slate-700">{row.label}</span>
                            <span className="ml-2 text-xs text-slate-500">{formatCurrencyMap(row.totalsByCurrency)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Aging buckets</h2>
                <div className="mt-3 space-y-2">
                  {summary.risk.agingBuckets.map((bucket) => (
                    <button
                      type="button"
                      key={bucket.bucket}
                      className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        dispatch({ type: "set_overdue_only", value: true });
                        dispatch({ type: "set_tab", tab: "documents" });
                      }}
                    >
                      <span className="text-sm text-slate-700">{bucket.label}</span>
                      <span className="text-xs text-slate-500">
                        {bucket.invoiceCount} · {formatCurrencyMap(bucket.totalsByCurrency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Top overdue customers</h2>
                <div className="mt-3 space-y-2">
                  {summary.risk.topOverdueCustomers.slice(0, 6).map((row) => (
                    <button
                      type="button"
                      key={row.customerKey}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        dispatch({ type: "add_filter_value", key: "customerKeys", value: row.customerKey });
                        dispatch({ type: "set_overdue_only", value: true });
                      }}
                    >
                      <div className="text-sm font-medium text-slate-800">{row.customerLabel}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.invoiceCount} invoices · max {row.maxDaysOverdue}d · {formatCurrencyMap(row.totalsByCurrency)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Top overdue invoices</h2>
                <div className="mt-3 space-y-2">
                  {summary.risk.topOverdueInvoices.slice(0, 6).map((invoice) => (
                    <div key={invoice.invoiceId} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-800">{invoice.invoiceNumber}</div>
                        <Badge className="border-rose-200 bg-rose-100 text-rose-800">{invoice.daysOverdue}d</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {invoice.customerLabel} · {formatCurrencyMap({ [invoice.currency]: invoice.amount })}
                      </div>
                      <div className="mt-2">
                        <Link to={`/invoices/${invoice.invoiceId}`} className="text-xs text-blue-700 hover:underline">
                          Open invoice
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Detailed table</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Total {records?.totalCount || 0}</span>
                  <span>·</span>
                  <span>{formatCurrencyMap(records?.totalsByCurrency || {})}</span>
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) => dispatch({ type: "set_tab", tab: value as typeof activeTab })}
              >
                <TabsList>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="customers">Customers</TabsTrigger>
                  <TabsTrigger value="proposals">Proposals</TabsTrigger>
                  <TabsTrigger value="collections">Collections</TabsTrigger>
                </TabsList>

                {(["documents", "customers", "proposals", "collections"] as const).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Sort field</Label>
                        <Select
                          value={state.table.sort.field}
                          onValueChange={(value) =>
                            dispatch({
                              type: "set_sort",
                              sort: {
                                ...state.table.sort,
                                field: value,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {tableColumns.length ? (
                              tableColumns.map((column) => (
                                <SelectItem key={column} value={column}>{column}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="date">date</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Sort direction</Label>
                        <Select
                          value={state.table.sort.direction}
                          onValueChange={(value) =>
                            dispatch({
                              type: "set_sort",
                              sort: {
                                ...state.table.sort,
                                direction: value as "asc" | "desc",
                              },
                            })
                          }
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">desc</SelectItem>
                            <SelectItem value="asc">asc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Group by</Label>
                        <Select
                          value={state.table.groupBy || "none"}
                          onValueChange={(value) => dispatch({ type: "set_group_by", groupBy: value === "none" ? null : value })}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none</SelectItem>
                            {tableColumns.map((column) => (
                              <SelectItem key={`group:${column}`} value={column}>{column}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Page size</Label>
                        <Select
                          value={String(state.table.pageSize)}
                          onValueChange={(value) => dispatch({ type: "set_page_size", pageSize: Number(value) })}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[25, 50, 100, 200].map((size) => (
                              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {records?.groups?.length ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        {records.groups.slice(0, 6).map((group) => (
                          <span key={group.key} className="mr-3 inline-block">
                            {group.key}: {group.count} ({formatCurrencyMap(group.totalsByCurrency)})
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {records?.records?.length ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              {tableColumns.map((column) => (
                                <th key={column} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                  {column}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">open</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {records.records.map((row, index) => {
                              const recordId = String(row.id || "");
                              const linkedInvoiceId = String(row.linkedInvoiceId || "");
                              const customerKey = String(row.customerKey || "");

                              const targetUrl =
                                tab === "documents" || tab === "collections"
                                  ? `/invoices/${recordId}`
                                  : tab === "proposals"
                                    ? linkedInvoiceId
                                      ? `/invoices/${linkedInvoiceId}`
                                      : `/proposals/${recordId}`
                                    : customerKey
                                      ? `/contacts/${customerKey}`
                                      : undefined;

                              return (
                                <tr key={`${recordId || "row"}-${index}`} className="hover:bg-slate-50/60">
                                  {tableColumns.map((column) => {
                                    const value = row[column];
                                    const isDateColumn = column.toLowerCase().includes("date") || column.toLowerCase().includes("at");
                                    const isStatusColumn = column === "status";
                                    const display =
                                      value === null || value === undefined || value === ""
                                        ? "-"
                                        : isDateColumn && typeof value === "string"
                                          ? formatDateShort(new Date(value))
                                          : String(value);

                                    return (
                                      <td key={`${recordId}-${column}`} className="whitespace-nowrap px-3 py-2 text-slate-700">
                                        {isStatusColumn && typeof value === "string" ? (
                                          <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusTone(value)}`}>{value}</span>
                                        ) : (
                                          display
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-slate-700">
                                    {targetUrl ? (
                                      <Link to={targetUrl} className="text-xs text-blue-700 hover:underline">
                                        Open
                                      </Link>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                        No records match the current filter set.
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div>
                        Page {records?.page || 1} / {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(records?.page || 1) <= 1}
                          onClick={() => dispatch({ type: "set_page", page: Math.max(1, (records?.page || 1) - 1) })}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(records?.page || 1) >= totalPages}
                          onClick={() => dispatch({ type: "set_page", page: (records?.page || 1) + 1 })}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Data trust</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="font-semibold text-slate-800">Coverage</div>
                  <div className="mt-1">Owner derivation: {summary.trust.ownerDerivationCoveragePct.toFixed(1)}%</div>
                  <div>Market derivation: {summary.trust.marketDerivationCoveragePct.toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="font-semibold text-slate-800">Metric definitions</div>
                  <div className="mt-1">Each KPI includes inclusion/exclusion scope, formula, time basis, currency basis, and last update timestamp.</div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {Object.entries(summary.trust.metricDefinitions).map(([metric, definition]) => (
                  <div key={metric} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
                    <div className="font-semibold text-slate-800">{metric}</div>
                    <div className="mt-1"><span className="font-medium">Includes:</span> {definition.includes}</div>
                    <div className="mt-1"><span className="font-medium">Excludes:</span> {definition.excludes}</div>
                    <div className="mt-1"><span className="font-medium">Formula:</span> {definition.formula}</div>
                    <div className="mt-1"><span className="font-medium">Time basis:</span> {definition.timeBasis}</div>
                    <div className="mt-1"><span className="font-medium">Currency basis:</span> {definition.currencyBasis}</div>
                  </div>
                ))}
              </div>

              {summary.trust.caveats.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <TriangleAlert className="h-4 w-4" />
                    Caveats
                  </div>
                  <ul className="list-disc space-y-1 pl-4">
                    {summary.trust.caveats.map((caveat, index) => (
                      <li key={`${caveat}-${index}`}>{caveat}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </>
        )}

        {!isLoading && summary && records && records.totalCount === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No analytics data yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              As proposals, invoices, and payment statuses start flowing, this page will surface KPI trends, receivables risk, and operational priorities.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Suggested first actions: create a proposal, issue invoices, and update payment statuses to unlock collection metrics.
            </p>
          </section>
        ) : null}

        {!isLoading && summary && hasLowData ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Low-data mode: totals are shown, while advanced ratios may be unstable until more records are captured for this period.
          </section>
        ) : null}
      </div>
    </div>
  );
}
