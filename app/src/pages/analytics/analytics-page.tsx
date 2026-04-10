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
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Loader2,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
  opts: { empty?: string } = {},
): string {
  const entries = Object.entries(totals || {});
  if (entries.length === 0) return opts.empty || "—";
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
  if (value.includes("paid") || value.includes("collected") || value.includes("accepted"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("overdue") || value.includes("rejected") || value.includes("cancel"))
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (value.includes("sent") || value.includes("outstanding") || value.includes("invoiced"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function sparklinePath(points: number[], width = 80, height = 22): string {
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

function formatDelta(delta: number | null): string {
  if (delta === null || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function toCsv(records: Array<Record<string, unknown>>): string {
  if (!records.length) return "";
  const headers = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (text.includes(",") || text.includes("\n") || text.includes('"'))
      return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [
    headers.join(","),
    ...records.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
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

function buildTrendData(
  selectedCurrency: string,
  summary: ReturnType<typeof useBusinessAnalyticsSummary>["data"],
): {
  invoicedCollected: TrendPoint[];
  receivables: TrendPoint[];
  proposalFlow: TrendPoint[];
} {
  if (!summary) return { invoicedCollected: [], receivables: [], proposalFlow: [] };
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
    })),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value))
    return <span className="text-[10px] text-slate-400">—</span>;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        flat ? "text-slate-500" : up ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {!flat &&
        (up ? (
          <TrendingUp className="h-2.5 w-2.5" />
        ) : (
          <TrendingDown className="h-2.5 w-2.5" />
        ))}
      {formatDelta(value)}
    </span>
  );
}

function KpiCell({
  label,
  value,
  delta,
  sparkline,
  toneColor,
  onClick,
}: {
  label: string;
  value: string;
  delta: number | null;
  sparkline: number[];
  toneColor: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none"
    >
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums leading-none text-slate-900">
        {value}
      </span>
      <div className="flex w-full items-center justify-between">
        <DeltaBadge value={delta} />
        <svg viewBox="0 0 80 22" className="h-4 w-16">
          {sparkline.length > 0 && (
            <path
              d={sparklinePath(sparkline)}
              fill="none"
              stroke={toneColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </button>
  );
}

function RankedList({
  rows,
  currency,
  onRowClick,
}: {
  rows: BusinessAnalyticsBreakdownRow[];
  currency: string;
  onRowClick?: (key: string) => void;
}) {
  const maxTotal = Math.max(
    ...rows.map((r) => r.totalsByCurrency[currency] || 0),
    1,
  );
  return (
    <div className="space-y-3">
      {rows.slice(0, 7).map((row) => {
        const total = row.totalsByCurrency[currency] || 0;
        const pct = (total / maxTotal) * 100;
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => onRowClick?.(row.key)}
            className="group w-full text-left"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-xs text-slate-700">{row.label}</span>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <span className="text-[10px] tabular-nums text-slate-400">{row.count}</span>
                <span className="text-xs font-medium tabular-nums text-slate-800">
                  {formatCurrencyMap({ [currency]: total })}
                </span>
              </div>
            </div>
            <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-700 transition-colors group-hover:bg-slate-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: currentOrg, isLoading: currentOrgLoading } = useCurrentOrganization();
  const { data: organizations = [] } = useOrganizations();
  const { formatDateShort } = useDateFormatting();

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [dateRange, setDateRange] = useState(getDefaultRange());
  const [comparePrevious, setComparePrevious] = useState(true);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState<string>("none");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [state, dispatch] = useReducer(analyticsReducer, DEFAULT_ANALYTICS_STATE);

  useEffect(() => {
    if (currentOrg?.id && !selectedOrgId) {
      setSelectedOrgId(currentOrg.id);
    }
  }, [currentOrg?.id, selectedOrgId]);

  const summaryPayload: BusinessAnalyticsSummaryPayload | null = selectedOrgId
    ? { orgId: selectedOrgId, dateRange, comparePrevious, filters: state.filters }
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

  const hasLowData =
    Boolean(summary) && records?.totalCount !== undefined && records.totalCount < 5;

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
    toast.success("Records exported");
  };

  const handleExportConfig = () => {
    if (!summaryPayload) return;
    const payload = buildAnalyticsExportPayload(summaryPayload, state);
    downloadFile(
      `analytics-view-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("Filter config exported");
  };

  const handleSaveView = async () => {
    const trimmed = viewName.trim();
    if (!trimmed) { toast.error("Enter a view name"); return; }
    const payload = buildAnalyticsViewPayload(state);
    try {
      await createView.mutateAsync({
        name: trimmed,
        filters: { ...payload.filters, dateRange, comparePrevious },
        tableConfig: payload.tableConfig,
      });
      setViewName("");
      toast.success("View saved");
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
          filters: { ...payload.filters, dateRange, comparePrevious },
          tableConfig: payload.tableConfig,
        },
      });
      toast.success("View updated");
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
      toast.success("View deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete view");
    }
  };

  const handleApplySavedView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (viewId === "none") return;
    const view = views.find((item) => item.id === viewId);
    if (!view) return;
    dispatch({ type: "apply_saved_view", filters: view.filters, tableConfig: view.tableConfig });
    if (view.filters.dateRange) setDateRange(view.filters.dateRange);
    if (typeof view.filters.comparePrevious === "boolean")
      setComparePrevious(view.filters.comparePrevious);
    toast.success(`Applied: ${view.name}`);
  };

  const tableColumns = useMemo(() => {
    const first = records?.records?.[0];
    return first ? Object.keys(first) : [];
  }, [records?.records]);

  const activeTab = state.table.tab;
  const totalPages = records ? Math.max(1, Math.ceil(records.totalCount / records.pageSize)) : 1;

  const compactFormat = (val: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(val);

  return (
    <div className="min-h-full bg-slate-50 pb-10 pt-5">
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-4 sm:px-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Business Analytics</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {dateRange.start} – {dateRange.end}
              {comparePrevious ? " · vs prior period" : ""}
              {summary?.trust.lastUpdatedAt
                ? ` · updated ${formatDateShort(new Date(summary.trust.lastUpdatedAt))}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {organizations.length > 1 && (
              <Select value={selectedOrgId || ""} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input
              type="date"
              className="h-8 w-[130px] text-xs"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              max={dateRange.end}
            />
            <span className="text-xs text-slate-400">–</span>
            <Input
              type="date"
              className="h-8 w-[130px] text-xs"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              min={dateRange.start}
              max={getTodayIso()}
            />

            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => handleQuickRange(d)}
              >
                {d}D
              </Button>
            ))}

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <div className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5">
              <Switch
                checked={comparePrevious}
                onCheckedChange={setComparePrevious}
                id="compare"
              />
              <Label htmlFor="compare" className="cursor-pointer text-xs text-slate-600">
                Compare
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {pills.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-800 px-1 text-[10px] text-white">
                  {pills.length}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUp className="ml-1 h-3 w-3" />
              ) : (
                <ChevronDown className="ml-1 h-3 w-3" />
              )}
            </Button>

            <Select value={selectedViewId} onValueChange={handleApplySavedView}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Saved view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No saved view</SelectItem>
                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={handleExportRows}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        {filtersOpen && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {[
                {
                  label: "Document type",
                  options: filterOptions.documentTypes,
                  key: "documentTypes" as const,
                },
                { label: "Status", options: filterOptions.statuses, key: "statuses" as const },
                {
                  label: "Customer",
                  options: filterOptions.customers,
                  key: "customerKeys" as const,
                },
                { label: "Owner", options: filterOptions.owners, key: "ownerIds" as const },
                {
                  label: "Currency",
                  options: filterOptions.currencies,
                  key: "currencies" as const,
                },
                { label: "Market", options: filterOptions.markets, key: "markets" as const },
                {
                  label: "Payment",
                  options: filterOptions.paymentStates,
                  key: "paymentStates" as const,
                },
              ].map(({ label, options, key }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-slate-500">{label}</Label>
                  <Select
                    onValueChange={(v) =>
                      dispatch({ type: "add_filter_value", key, value: v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(state.filters.overdueOnly)}
                  onCheckedChange={(v) => dispatch({ type: "set_overdue_only", value: v })}
                  id="overdue-only"
                />
                <Label htmlFor="overdue-only" className="cursor-pointer text-xs text-slate-600">
                  Overdue only
                </Label>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={() => dispatch({ type: "clear_filters" })}
              >
                Clear all
              </Button>

              <Separator orientation="vertical" className="mx-1 h-4" />

              <Input
                className="h-7 w-[180px] text-xs"
                placeholder="Name this view…"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSaveView}>
                <Save className="mr-1 h-3 w-3" />Save
              </Button>
              {selectedViewId && selectedViewId !== "none" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleUpdateView}
                  >
                    Update
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-rose-600 hover:text-rose-700"
                    onClick={handleDeleteView}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />Delete
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs text-slate-400"
                onClick={handleExportConfig}
              >
                Export config
              </Button>
            </div>
          </div>
        )}

        {/* ── Active filter pills ──────────────────────────────────────────── */}
        {pills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((pill) => (
              <Badge
                key={`${pill.key}:${pill.value}`}
                variant="outline"
                className="h-6 cursor-pointer border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => handlePillRemove(pill.key, pill.value)}
              >
                {pill.label} ×
              </Badge>
            ))}
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!isLoading && summary && records && records.totalCount === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No data for this period</p>
            <p className="mt-1 text-xs text-slate-400">
              Create proposals or invoices to start seeing analytics.
            </p>
          </div>
        )}

        {!isLoading && summary && (
          <>
            {/* ── KPI strip ──────────────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid divide-x divide-slate-100 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
                <KpiCell
                  label="Total Invoiced"
                  value={formatCurrencyMap(summary.kpis.totalInvoiced.totalsByCurrency)}
                  delta={Object.values(summary.kpis.totalInvoiced.deltaPctByCurrency)[0] ?? null}
                  sparkline={summary.kpis.totalInvoiced.sparkline}
                  toneColor="#475569"
                  onClick={() =>
                    dispatch({ type: "set_filter_array", key: "statuses", values: ["sent", "paid"] })
                  }
                />
                <KpiCell
                  label="Collected"
                  value={formatCurrencyMap(summary.kpis.collectedAmount.totalsByCurrency)}
                  delta={Object.values(summary.kpis.collectedAmount.deltaPctByCurrency)[0] ?? null}
                  sparkline={summary.kpis.collectedAmount.sparkline}
                  toneColor="#16a34a"
                  onClick={() =>
                    dispatch({ type: "set_filter_array", key: "statuses", values: ["paid"] })
                  }
                />
                <KpiCell
                  label="Outstanding"
                  value={formatCurrencyMap(summary.kpis.outstandingAmount.totalsByCurrency)}
                  delta={Object.values(summary.kpis.outstandingAmount.deltaPctByCurrency)[0] ?? null}
                  sparkline={summary.kpis.outstandingAmount.sparkline}
                  toneColor="#f59e0b"
                  onClick={() =>
                    dispatch({ type: "set_filter_array", key: "statuses", values: ["sent"] })
                  }
                />
                <KpiCell
                  label="Overdue"
                  value={formatCurrencyMap(summary.kpis.overdueAmount.totalsByCurrency)}
                  delta={Object.values(summary.kpis.overdueAmount.deltaPctByCurrency)[0] ?? null}
                  sparkline={summary.kpis.overdueAmount.sparkline}
                  toneColor="#e11d48"
                  onClick={() => {
                    dispatch({ type: "set_filter_array", key: "statuses", values: ["sent"] });
                    dispatch({ type: "set_overdue_only", value: true });
                  }}
                />
                <KpiCell
                  label="Proposals Accepted"
                  value={formatCurrencyMap(summary.kpis.proposalAcceptedValue.totalsByCurrency)}
                  delta={
                    Object.values(summary.kpis.proposalAcceptedValue.deltaPctByCurrency)[0] ?? null
                  }
                  sparkline={summary.kpis.proposalAcceptedValue.sparkline}
                  toneColor="#2563eb"
                  onClick={() =>
                    dispatch({
                      type: "set_filter_array",
                      key: "documentTypes",
                      values: ["proposal"],
                    })
                  }
                />
                <KpiCell
                  label="Proposal → Invoice"
                  value={
                    summary.kpis.proposalToInvoiceConversionRate.value !== null
                      ? `${summary.kpis.proposalToInvoiceConversionRate.value.toFixed(1)}%`
                      : "—"
                  }
                  delta={summary.kpis.proposalToInvoiceConversionRate.deltaPct}
                  sparkline={summary.kpis.proposalToInvoiceConversionRate.sparkline}
                  toneColor="#7c3aed"
                  onClick={() => dispatch({ type: "set_tab", tab: "proposals" })}
                />
                <KpiCell
                  label="Avg Collection"
                  value={
                    summary.kpis.averageCollectionDays.value !== null
                      ? `${summary.kpis.averageCollectionDays.value.toFixed(0)}d`
                      : "—"
                  }
                  delta={summary.kpis.averageCollectionDays.deltaPct}
                  sparkline={summary.kpis.averageCollectionDays.sparkline}
                  toneColor="#0891b2"
                  onClick={() => dispatch({ type: "set_tab", tab: "collections" })}
                />
              </div>
            </div>

            {/* ── Charts + Breakdowns ──────────────────────────────────────── */}
            <div className="grid gap-4 xl:grid-cols-5">
              {/* Charts */}
              <div className="space-y-4 xl:col-span-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-slate-700">Revenue trend</h2>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-sm bg-slate-800" />
                        Invoiced
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-sm bg-emerald-600" />
                        Collected
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>{selectedCurrency}</span>
                    </div>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData.invoicedCollected}
                        margin={{ top: 4, right: 0, left: -16, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gInvoiced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0f172a" stopOpacity={0.07} />
                            <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.07} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={compactFormat}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: 12,
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                          }}
                          formatter={(val: number) => [compactFormat(val)]}
                        />
                        <Area
                          dataKey="invoiced"
                          type="monotone"
                          stroke="#0f172a"
                          fill="url(#gInvoiced)"
                          strokeWidth={1.5}
                          dot={false}
                          name="Invoiced"
                        />
                        <Area
                          dataKey="collected"
                          type="monotone"
                          stroke="#16a34a"
                          fill="url(#gCollected)"
                          strokeWidth={1.5}
                          dot={false}
                          name="Collected"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-slate-700">Receivables</h2>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-px w-4 bg-amber-400" />
                          Outstanding
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-px w-4 bg-rose-500" />
                          Overdue
                        </span>
                      </div>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData.receivables}
                          margin={{ top: 4, right: 0, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="2 4"
                            stroke="#f1f5f9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="period"
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={compactFormat}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: 11,
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                            }}
                            formatter={(val: number) => [compactFormat(val)]}
                          />
                          <Line
                            dataKey="outstanding"
                            type="monotone"
                            stroke="#f59e0b"
                            dot={false}
                            strokeWidth={1.5}
                            name="Outstanding"
                          />
                          <Line
                            dataKey="overdue"
                            type="monotone"
                            stroke="#e11d48"
                            dot={false}
                            strokeWidth={1.5}
                            name="Overdue"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-slate-700">Proposal flow</h2>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-px w-4 bg-blue-600" />
                          Accepted
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-px w-4 bg-emerald-600" />
                          Invoiced
                        </span>
                      </div>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData.proposalFlow}
                          margin={{ top: 4, right: 0, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="2 4"
                            stroke="#f1f5f9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="period"
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={compactFormat}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: 11,
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                            }}
                            formatter={(val: number) => [compactFormat(val)]}
                          />
                          <Line
                            dataKey="acceptedValue"
                            type="monotone"
                            stroke="#2563eb"
                            dot={false}
                            strokeWidth={1.5}
                            name="Accepted"
                          />
                          <Line
                            dataKey="invoicedValue"
                            type="monotone"
                            stroke="#16a34a"
                            dot={false}
                            strokeWidth={1.5}
                            name="Invoiced"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdowns panel */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
                <h2 className="mb-3 text-sm font-medium text-slate-700">Breakdown</h2>
                <Tabs defaultValue="customers">
                  <TabsList className="h-7 w-full bg-slate-100 p-0.5">
                    <TabsTrigger value="customers" className="h-6 flex-1 text-xs">
                      Customers
                    </TabsTrigger>
                    <TabsTrigger value="statuses" className="h-6 flex-1 text-xs">
                      Statuses
                    </TabsTrigger>
                    <TabsTrigger value="markets" className="h-6 flex-1 text-xs">
                      Markets
                    </TabsTrigger>
                    <TabsTrigger value="owners" className="h-6 flex-1 text-xs">
                      Owners
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="customers" className="mt-4">
                    <RankedList
                      rows={summary.breakdowns.customers}
                      currency={selectedCurrency}
                      onRowClick={(key) =>
                        dispatch({ type: "add_filter_value", key: "customerKeys", value: key })
                      }
                    />
                  </TabsContent>
                  <TabsContent value="statuses" className="mt-4">
                    <RankedList
                      rows={summary.breakdowns.statuses}
                      currency={selectedCurrency}
                      onRowClick={(key) =>
                        dispatch({ type: "add_filter_value", key: "statuses", value: key })
                      }
                    />
                  </TabsContent>
                  <TabsContent value="markets" className="mt-4">
                    <RankedList
                      rows={summary.breakdowns.markets}
                      currency={selectedCurrency}
                      onRowClick={(key) =>
                        dispatch({ type: "add_filter_value", key: "markets", value: key })
                      }
                    />
                  </TabsContent>
                  <TabsContent value="owners" className="mt-4">
                    <RankedList
                      rows={summary.breakdowns.owners}
                      currency={selectedCurrency}
                      onRowClick={(key) =>
                        dispatch({ type: "add_filter_value", key: "ownerIds", value: key })
                      }
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* ── Risk row ──────────────────────────────────────────────────── */}
            <div className="grid gap-4 xl:grid-cols-3">
              {/* Aging buckets */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-slate-700">Aging buckets</h2>
                <div className="space-y-1">
                  {summary.risk.agingBuckets.map((bucket, i) => {
                    const dot =
                      i === 0
                        ? "bg-slate-400"
                        : i === 1
                          ? "bg-amber-400"
                          : "bg-rose-500";
                    return (
                      <button
                        type="button"
                        key={bucket.bucket}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          dispatch({ type: "set_overdue_only", value: true });
                          dispatch({ type: "set_tab", tab: "documents" });
                        }}
                      >
                        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                        <span className="flex-1 text-xs text-slate-700">{bucket.label}</span>
                        <span className="tabular-nums text-[10px] text-slate-400">
                          {bucket.invoiceCount}
                        </span>
                        <span className="tabular-nums text-xs font-medium text-slate-800">
                          {formatCurrencyMap(bucket.totalsByCurrency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Top overdue customers */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-slate-700">Top overdue customers</h2>
                <div className="space-y-1">
                  {summary.risk.topOverdueCustomers.slice(0, 5).map((row) => (
                    <button
                      type="button"
                      key={row.customerKey}
                      className="w-full rounded-md px-2 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        dispatch({
                          type: "add_filter_value",
                          key: "customerKeys",
                          value: row.customerKey,
                        });
                        dispatch({ type: "set_overdue_only", value: true });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs font-medium text-slate-800">
                          {row.customerLabel}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums text-xs font-medium text-rose-600">
                          {formatCurrencyMap(row.totalsByCurrency)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {row.invoiceCount} invoices · {row.maxDaysOverdue}d max overdue
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Top overdue invoices */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-slate-700">Top overdue invoices</h2>
                <div className="space-y-1">
                  {summary.risk.topOverdueInvoices.slice(0, 5).map((invoice) => (
                    <div
                      key={invoice.invoiceId}
                      className="flex items-start gap-3 rounded-md px-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-800">
                            {invoice.invoiceNumber}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                            {invoice.daysOverdue}d
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{invoice.customerLabel}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums text-xs font-medium text-slate-700">
                          {formatCurrencyMap({ [invoice.currency]: invoice.amount })}
                        </p>
                        <Link
                          to={`/invoices/${invoice.invoiceId}`}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Detail table ──────────────────────────────────────────────── */}
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-700">Records</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="tabular-nums">{records?.totalCount || 0} rows</span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {formatCurrencyMap(records?.totalsByCurrency || {})}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) =>
                    dispatch({ type: "set_tab", tab: v as typeof activeTab })
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList className="h-8 bg-slate-100">
                      <TabsTrigger value="documents" className="h-7 text-xs">Documents</TabsTrigger>
                      <TabsTrigger value="customers" className="h-7 text-xs">Customers</TabsTrigger>
                      <TabsTrigger value="proposals" className="h-7 text-xs">Proposals</TabsTrigger>
                      <TabsTrigger value="collections" className="h-7 text-xs">Collections</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-1.5">
                      <Select
                        value={state.table.sort.field}
                        onValueChange={(v) =>
                          dispatch({
                            type: "set_sort",
                            sort: { ...state.table.sort, field: v },
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-[120px] text-xs">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.length ? (
                            tableColumns.map((col) => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="date">date</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Select
                        value={state.table.sort.direction}
                        onValueChange={(v) =>
                          dispatch({
                            type: "set_sort",
                            sort: { ...state.table.sort, direction: v as "asc" | "desc" },
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-[80px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">↓ Desc</SelectItem>
                          <SelectItem value="asc">↑ Asc</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(state.table.pageSize)}
                        onValueChange={(v) =>
                          dispatch({ type: "set_page_size", pageSize: Number(v) })
                        }
                      >
                        <SelectTrigger className="h-7 w-[70px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[25, 50, 100, 200].map((size) => (
                            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(["documents", "customers", "proposals", "collections"] as const).map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                      {records?.groups?.length ? (
                        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                          {records.groups.slice(0, 6).map((group) => (
                            <span key={group.key} className="text-xs text-slate-600">
                              <span className="font-medium">{group.key}</span>
                              {" — "}
                              {group.count}
                              {" ("}
                              {formatCurrencyMap(group.totalsByCurrency)}
                              {")"}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {records?.records?.length ? (
                        <div className="overflow-x-auto rounded-md border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50">
                              <tr>
                                {tableColumns.map((col) => (
                                  <th
                                    key={col}
                                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500"
                                  >
                                    {col}
                                  </th>
                                ))}
                                <th className="px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
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
                                  <tr
                                    key={`${recordId || "row"}-${index}`}
                                    className="hover:bg-slate-50/60"
                                  >
                                    {tableColumns.map((col) => {
                                      const value = row[col];
                                      const isDate =
                                        col.toLowerCase().includes("date") ||
                                        col.toLowerCase().includes("at");
                                      const isStatus = col === "status";
                                      const display =
                                        value === null || value === undefined || value === ""
                                          ? "—"
                                          : isDate && typeof value === "string"
                                            ? formatDateShort(new Date(value))
                                            : String(value);

                                      return (
                                        <td
                                          key={`${recordId}-${col}`}
                                          className="whitespace-nowrap px-3 py-2 text-slate-700"
                                        >
                                          {isStatus && typeof value === "string" ? (
                                            <span
                                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${statusTone(value)}`}
                                            >
                                              {value}
                                            </span>
                                          ) : (
                                            display
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-right">
                                      {targetUrl ? (
                                        <Link
                                          to={targetUrl}
                                          className="text-blue-600 hover:underline"
                                        >
                                          Open
                                        </Link>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-xs text-slate-400">
                          No records match the current filter set.
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Page {records?.page || 1} of {totalPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={(records?.page || 1) <= 1}
                            onClick={() =>
                              dispatch({
                                type: "set_page",
                                page: Math.max(1, (records?.page || 1) - 1),
                              })
                            }
                          >
                            Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={(records?.page || 1) >= totalPages}
                            onClick={() =>
                              dispatch({ type: "set_page", page: (records?.page || 1) + 1 })
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>

            {/* ── Notices ───────────────────────────────────────────────────── */}
            {hasLowData && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                Low-data mode: totals are shown, but advanced ratios may be unreliable until
                more records are captured for this period.
              </div>
            )}

            {summary.trust.caveats.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {summary.trust.caveats.length} data caveat
                  {summary.trust.caveats.length !== 1 ? "s" : ""}
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                  {summary.trust.caveats.map((caveat, i) => (
                    <li key={`${caveat}-${i}`}>{caveat}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
