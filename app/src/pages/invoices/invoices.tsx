import { useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useRenderInvoicePdf } from "@/hooks";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Download,
  FileText,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  MoreHorizontal,
  Eye,
  Upload,
  ArrowUpRight,
  Hash,
  Layers,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/core/entities/invoice";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { getInvoiceValue, formatInvoiceAmount, getInvoiceAmountAndCurrency } from "@/utils/invoice-helpers";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";


// ── Row shape fed into TanStack Table ──────────────────────────────────────
interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  date: string;
  dateSortKey: number;           // epoch ms for sorting
  status: string;
  amount: string;
  amountSortKey: number;         // raw number for sorting
  raw: Invoice;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getInvoiceNumber(invoice: Invoice): string {
  return (
    getInvoiceValue(invoice, "invoiceNumber") ||
    getInvoiceValue(invoice, "number") ||
    invoice.id.slice(0, 8)
  );
}

function getInvoiceDate(invoice: Invoice, formatDateShort: (d: Date | string | number) => string): { display: string; epoch: number } {
  const raw = getInvoiceValue(invoice, "issueDate") || getInvoiceValue(invoice, "date");
  if (!raw) return { display: "", epoch: 0 };
  try {
    const d = new Date(raw);
    return { display: formatDateShort(d), epoch: d.getTime() };
  } catch {
    return { display: raw, epoch: 0 };
  }
}

function getBuyerName(invoice: Invoice, unknownLabel: string): string {
  return (
    getInvoiceValue(invoice, "buyer.name") ||
    getInvoiceValue(invoice, "customer.name") ||
    getInvoiceValue(invoice, "client.name") ||
    unknownLabel
  );
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:     { dot: "bg-zinc-400",    bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-600 dark:text-zinc-300",      border: "border-zinc-300 dark:border-zinc-600",     bar: "bg-zinc-300 dark:bg-zinc-600" },
  sent:      { dot: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-950",       text: "text-blue-700 dark:text-blue-300",      border: "border-blue-200 dark:border-blue-800",     bar: "bg-blue-400" },
  paid:      { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300",border: "border-emerald-200 dark:border-emerald-800",bar: "bg-emerald-500" },
  cancelled: { dot: "bg-red-400",     bg: "bg-red-50 dark:bg-red-950",         text: "text-red-600 dark:text-red-400",        border: "border-red-200 dark:border-red-800",        bar: "bg-red-400" },
} as const;
type StatusKey = keyof typeof STATUS_CFG;

// ── Sort indicator icon ────────────────────────────────────────────────────
function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc")  return <ChevronUp   className="h-3 w-3 text-foreground" />;
  if (direction === "desc") return <ChevronDown  className="h-3 w-3 text-foreground" />;
  return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: invoices, isLoading, isError } = useInvoices(currentOrganization?.id);

  const [previewUrl, setPreviewUrl]             = useState<string | null>(null);
  const [searchTerm, setSearchTerm]             = useState("");
  const [statusFilter, setStatusFilter]         = useState<string>("all");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sorting, setSorting]                   = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const renderPdf = useRenderInvoicePdf();
  const handleCreate        = useCallback(() => navigate("/create-invoice"), [navigate]);
  const handleUploadInvoice = useCallback(() => navigate("/invoice-upload-flow", { state: { flowType: "invoice", returnTo: "/invoices" } }), [navigate]);

  // Stable ref so columns memo doesn't need to re-run when renderPdf/t change
  const handleGeneratePdfRef = useRef<(invoiceId: string, e: React.MouseEvent) => void>(null!);
  handleGeneratePdfRef.current = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    renderPdf.mutate({ invoiceId }, {
      onSuccess: (result) => { toast.success(t('invoices.messages.pdfGenerated')); window.open(result.url, "_blank"); },
      onError:   (err)    => { toast.error(t('invoices.messages.pdfFailed', { error: err.message })); },
    });
  };

  // ── Flatten invoices → rows ──────────────────────────────────────────────
  const allRows = useMemo<InvoiceRow[]>(() => {
    const unknown = t('invoices.labels.unknown');
    return (invoices ?? []).map((inv) => {
      const { display, epoch } = getInvoiceDate(inv, formatDateShort);
      const { amount }         = getInvoiceAmountAndCurrency(inv);
      return {
        id:            inv.id,
        invoiceNumber: getInvoiceNumber(inv),
        buyerName:     getBuyerName(inv, unknown),
        date:          display,
        dateSortKey:   epoch,
        status:        inv.status || "draft",
        amount:        formatInvoiceAmount(inv),
        amountSortKey: amount,
        raw:           inv,
      };
    });
  }, [invoices, formatDateShort, t]);

  // Pre-filter (search + status) before handing to TanStack
  const filteredRows = useMemo(() => allRows.filter((row) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || row.invoiceNumber.toLowerCase().includes(q) || row.buyerName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [allRows, searchTerm, statusFilter]);

  // ── Column definitions ───────────────────────────────────────────────────
  // Stable: only rebuilds when navigate changes (essentially never).
  // handleGeneratePdf is accessed via ref so it's always fresh without being a dep.
  const columns = useMemo<ColumnDef<InvoiceRow>[]>(() => [
    {
      id: "invoiceNumber",
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">{row.original.invoiceNumber}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "buyerName",
      accessorKey: "buyerName",
      header: "Client",
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <span className="text-sm text-muted-foreground truncate">{row.original.buyerName}</span>
      ),
      enableSorting: true,
    },
    {
      id: "date",
      accessorKey: "dateSortKey",
      header: "Date",
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <span className="text-sm text-muted-foreground tabular-nums">{row.original.date || "—"}</span>
      ),
      enableSorting: true,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: Row<InvoiceRow> }) => {
        const s   = (row.original.status || "draft") as StatusKey;
        const cfg = STATUS_CFG[s] ?? STATUS_CFG.draft;
        return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "amount",
      accessorKey: "amountSortKey",
      header: "Amount",
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <span className="text-sm font-semibold text-foreground tabular-nums sm:text-right block">{row.original.amount}</span>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/invoices/${row.original.id}`)}>
              <Eye className="mr-2 h-3.5 w-3.5" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleGeneratePdfRef.current(row.original.id, e)}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Download PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [navigate]);

  // ── TanStack Table instance ──────────────────────────────────────────────
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange:          setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:          getCoreRowModel(),
    getSortedRowModel:        getSortedRowModel(),
    enableSortingRemoval:     true,
    // Prevents TanStack from resetting internal state on every data reference change
    autoResetAll: false,
  });

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalInvoices = invoices?.length || 0;
  const totalRevenue  = invoices?.reduce((s, inv) => s + getInvoiceAmountAndCurrency(inv).amount, 0) || 0;
  const monthCount    = invoices?.filter((inv) => {
    const d = new Date(inv.updatedAt || inv.createdAt || "");
    return Math.ceil(Math.abs(Date.now() - d.getTime()) / 86_400_000) <= 30;
  }).length || 0;

  // Columns that can be shown/hidden (those with enableHiding !== false)
  const toggleableColumns = table.getAllColumns().filter((col) => col.getCanHide());

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-5 w-full overflow-x-hidden">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('invoices.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('invoices.subtitle')}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setShowExportDialog(true)} className="flex-1 sm:flex-none h-9 text-sm">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button onClick={handleUploadInvoice} variant="outline" className="flex-1 sm:flex-none h-9 text-sm">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
            <Button onClick={handleCreate} className="flex-1 sm:flex-none h-9 text-sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('invoices.createInvoice')}
            </Button>
          </div>
        </div>

        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Layers className="h-4 w-4" />,      value: totalInvoices,               label: t('invoices.stats.totalInvoices') },
            { icon: <TrendingUp className="h-4 w-4" />,  value: `$${totalRevenue.toLocaleString()}`, label: t('invoices.stats.totalRevenue') },
            { icon: <Calendar className="h-4 w-4" />,    value: monthCount,                   label: t('invoices.stats.thisMonth') },
          ].map(({ icon, value, label }, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters + Column visibility ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('invoices.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder={t('invoices.filters.statusFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('invoices.filters.allStatus')}</SelectItem>
              <SelectItem value="draft">{t('invoices.filters.draft')}</SelectItem>
              <SelectItem value="sent">{t('invoices.filters.sent')}</SelectItem>
              <SelectItem value="paid">{t('invoices.filters.paid')}</SelectItem>
              <SelectItem value="cancelled">{t('invoices.filters.cancelled')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Column visibility toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 w-9 sm:w-auto sm:px-3 text-sm shrink-0" size="sm">
                <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleableColumns.map((col) => {
                const isVisible = col.getIsVisible();
                const headerContent = col.columnDef.header;
                const label = typeof headerContent === "string" ? headerContent : col.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={isVisible}
                    onCheckedChange={(val) => col.toggleVisibility(val)}
                    className="text-sm capitalize"
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-3 w-3 rounded-full shrink-0" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36 flex-1" />
                <Skeleton className="h-4 w-20 hidden sm:block" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 ml-auto" />
                <Skeleton className="h-7 w-7 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <FileText className="mx-auto h-9 w-9 text-destructive/60 mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">{t('invoices.error.loadFailed')}</h3>
            <p className="text-xs text-muted-foreground">{t('invoices.error.tryAgain')}</p>
          </div>
        )}

        {/* ── Invoice Table ── */}
        {!isLoading && !isError && (
          table.getRowModel().rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {searchTerm || statusFilter !== "all" ? t('invoices.empty.noInvoicesFound') : t('invoices.empty.noInvoicesYet')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                {searchTerm || statusFilter !== "all" ? t('invoices.empty.adjustFilters') : t('invoices.empty.getStarted')}
              </p>
              <Button onClick={handleCreate} size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('invoices.createInvoice')}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* ── Column headers ── */}
              <div className="hidden sm:flex bg-muted/40 border-b border-border">
                {/* Accent bar spacer */}
                <div className="w-[11px] shrink-0" />
                {table.getFlatHeaders().map((header) => {
                  if (header.column.id === "actions") return (
                    <div key={header.id} className="w-10 shrink-0 px-2 py-2.5" />
                  );
                  const canSort = header.column.getCanSort();
                  const sorted  = header.column.getIsSorted();
                  const id      = header.column.id;
                  const label   = id === "invoiceNumber" ? <><Hash className="h-3 w-3 shrink-0" /> Invoice</>
                                : id === "date"          ? <><Calendar className="h-3 w-3 shrink-0" /> Date</>
                                : (header.column.columnDef.header as string);
                  return (
                    <div
                      key={header.id}
                      className={`flex-1 min-w-0 px-3 py-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider select-none ${canSort ? "cursor-pointer hover:text-foreground transition-colors" : ""} ${id === "amount" ? "justify-end" : ""}`}
                      onClick={(e) => {
                        if (!canSort) return;
                        const handler = header.column.getToggleSortingHandler();
                        handler?.(e);
                      }}
                    >
                      {label}
                      {canSort && <SortIcon direction={sorted} />}
                    </div>
                  );
                })}
              </div>

              {/* ── Rows ── */}
              <div className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => {
                  const s   = (row.original.status || "draft") as StatusKey;
                  const bar = STATUS_CFG[s]?.bar ?? STATUS_CFG.draft.bar;
                  return (
                    <div
                      key={row.id}
                      className="group flex items-center cursor-pointer bg-card hover:bg-muted/30 transition-colors duration-150"
                      onClick={() => navigate(`/invoices/${row.original.id}`)}
                    >
                      {/* Status accent bar */}
                      <div className={`hidden sm:block self-stretch w-[3px] shrink-0 ${bar}`} />

                      {/* Cells */}
                      <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0 px-5 py-4 gap-3 sm:gap-0">
                        {row.getVisibleCells().map((cell) => {
                          if (cell.column.id === "actions") return null;
                          return (
                            <div
                              key={cell.id}
                              className={`sm:flex-1 min-w-0 sm:px-3 ${cell.column.id === "amount" ? "sm:text-right" : ""}`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions cell — always last */}
                      <div className="px-2 shrink-0">
                        {row.getVisibleCells().filter(c => c.column.id === "actions").map((cell) => (
                          <div key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Footer row count ── */}
              <div className="px-5 py-2 bg-muted/20 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {table.getRowModel().rows.length} of {allRows.length} invoice{allRows.length !== 1 ? "s" : ""}
                </p>
                {sorting.length > 0 && (
                  <button
                    onClick={() => setSorting([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear sort
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('invoices.preview.title')}</DialogTitle>
          </DialogHeader>
          <div className="aspect-[1/1.414] w-full overflow-hidden rounded-md border bg-muted">
            {previewUrl ? <iframe title="invoice-preview" src={previewUrl} className="h-full w-full" /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["invoices"]}
      />
    </div>
  );
}
