import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  Search,
  Mail,
  Phone,
  Building,
  MessageSquare,
  Sparkles,
  FileText,
  Download,
  MoreHorizontal,
  Plus,
  Trash2,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLeadsByOrg, useUpdateLead } from "@/hooks/repository-hooks/use-leads";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Lead, ProposalData, ProposalItem } from "@/core";
import { ProposalSuggestionDialog } from "@/components/proposal-suggestion-dialog";
import { useCreateProposal } from "@/hooks/repository-hooks/use-proposals";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getAllCurrencyCodes } from "@/utils/currencies";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { extractUrls, getFileLabelFromUrl } from "@/utils/file-links";
import { cn } from "@/lib/utils";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["new", "viewed", "contacted", "converted", "archived"] as const;
type LeadStatus = typeof STATUS_OPTIONS[number];

const STATUS_CONFIG: Record<
  LeadStatus,
  { dot: string; badge: string; activePill: string; idlePill: string }
> = {
  new: {
    dot: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    activePill: "bg-sky-600 text-white border-sky-600 shadow-sm",
    idlePill: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
  },
  viewed: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    activePill: "bg-amber-500 text-white border-amber-500 shadow-sm",
    idlePill: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  contacted: {
    dot: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    activePill: "bg-violet-600 text-white border-violet-600 shadow-sm",
    idlePill: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  },
  converted: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activePill: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    idlePill: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  archived: {
    dot: "bg-stone-400",
    badge: "bg-stone-50 text-stone-500 border-stone-200",
    activePill: "bg-stone-600 text-white border-stone-600 shadow-sm",
    idlePill: "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100",
  },
};

const WIDGET_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  contactForm: {
    label: "Contact",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  invoiceRequest: {
    label: "Invoice",
    badge: "bg-green-50 text-green-700 border-green-200",
  },
  quoteRequest: {
    label: "Quote",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
];

function getInitials(firstName: string, lastName: string): string {
  const a = (firstName || "").charAt(0).toUpperCase();
  const b = (lastName || "").charAt(0).toUpperCase();
  return (a + b).trim() || "?";
}

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Utility: render form data value (file links or plain text) ───────────────

// Extensions the browser can render natively — open directly.
// Everything else goes through Google Docs Viewer for a real preview.
const NATIVE_PREVIEW_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp",
  "mp4", "webm", "ogg", "mp3", "wav",
  "txt", "csv", "json", "xml", "html", "htm",
]);

function getPreviewUrl(url: string): string {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
    if (NATIVE_PREVIEW_EXTENSIONS.has(ext)) return url;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

function renderFormValue(value: unknown): React.ReactNode {
  if (typeof value === "object" && value !== null) {
    return (
      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  const raw = String(value ?? "").trim();
  if (!raw) return <span className="text-muted-foreground italic">—</span>;
  const urls = extractUrls(raw);
  if (urls.length === 0) return raw;
  return (
    <div className="space-y-1.5">
      {urls.map((url) => (
        <div key={url} className="flex items-center gap-2">
          <span className="text-xs font-medium truncate max-w-[150px]">
            {getFileLabelFromUrl(url)}
          </span>
          <a
            href={getPreviewUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Preview
          </a>
          <a
            href={url}
            download
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Download
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LeadsLoadingSkeleton() {
  return (
    <div className="py-6 pr-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-60 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-40 hidden md:block" />
              <Skeleton className="h-5 w-16 rounded-md hidden md:block" />
              <Skeleton className="h-3 w-28 hidden lg:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Lead Detail Panel (Sheet content) ────────────────────────────────────────

function LeadDetailPanel({
  lead,
  onStatusChange,
  onAIProposal,
  onManualProposal,
  isUpdating,
  t,
  formatDateTime,
}: {
  lead: Lead;
  onStatusChange: (status: string) => void;
  onAIProposal: () => void;
  onManualProposal: () => void;
  isUpdating: boolean;
  t: (key: string) => string;
  formatDateTime: (date: unknown) => string;
}) {
  const d = lead.data || lead;
  const fullName =
    [d.firstName, d.lastName].filter(Boolean).join(" ") || "Unknown Lead";
  const initials = getInitials(d.firstName || "", d.lastName || "");
  const avatarColor = getAvatarColor(fullName + (d.email || ""));
  const status = ((d.status || "new") as LeadStatus);
  const typeCfg =
    WIDGET_TYPE_CONFIG[d.widgetType] || { label: d.widgetType || "—", badge: "bg-gray-50 text-gray-600 border-gray-200" };

  return (
    <ScrollArea className="h-full">
      <div className="pb-10 pt-2">
        {/* ── Profile header ── */}
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0",
                avatarColor
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <SheetTitle className="text-base font-semibold leading-tight">
                {fullName}
              </SheetTitle>
              {d.email && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {d.email}
                </p>
              )}
              {d.company && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {d.company}
                  {d.jobTitle && (
                    <span className="text-muted-foreground/60"> · {d.jobTitle}</span>
                  )}
                </p>
              )}
              {lead.createdAt && (
                <p className="text-xs text-muted-foreground/60 mt-1.5">
                  Submitted {formatDateTime(lead.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Pipeline Status ── */}
        <div className="px-6 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Pipeline Status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => {
              const cfg = STATUS_CONFIG[s];
              const isActive = status === s;
              return (
                <button
                  key={s}
                  onClick={() => !isUpdating && onStatusChange(s)}
                  disabled={isUpdating}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 select-none",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isActive ? cfg.activePill : cfg.idlePill
                  )}
                >
                  {isActive && <span className="mr-1 opacity-80">✓</span>}
                  {t(`leads.status.${s}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ── Actions ── */}
        <div className="px-6 py-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-sm"
            onClick={onAIProposal}
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            AI Proposal
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-sm"
            onClick={onManualProposal}
          >
            <FileText className="h-3.5 w-3.5" />
            Create Proposal
          </Button>
        </div>

        <Separator />

        {/* ── Contact Info ── */}
        <div className="px-6 py-4 space-y-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Contact Info
          </p>

          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                typeCfg.badge
              )}
              style={{ border: "1px solid" }}
            >
              <MessageSquare className="h-3 w-3" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Form type</p>
              <p className="text-sm font-medium">{typeCfg.label}</p>
            </div>
          </div>

          {d.email && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-3 w-3 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{d.email}</p>
              </div>
            </div>
          )}

          {d.phone && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-3 w-3 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm">{d.phone}</p>
              </div>
            </div>
          )}

          {!d.email && !d.phone && (
            <p className="text-sm text-muted-foreground italic">
              No contact info provided
            </p>
          )}
        </div>

        {/* ── Message ── */}
        {d.message && (
          <>
            <Separator />
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Message
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {d.message}
              </p>
            </div>
          </>
        )}

        {/* ── Form Data ── */}
        {d.formData && Object.keys(d.formData).length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Submitted Data
              </p>
              {Object.entries(d.formData).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <div className="text-sm">{renderFormValue(value)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Notes ── */}
        {d.notes && (
          <>
            <Separator />
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Internal Notes
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {d.notes}
              </p>
            </div>
          </>
        )}

        {/* ── Tags ── */}
        {d.tags && d.tags.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {d.tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-muted rounded-full text-xs font-medium text-muted-foreground border border-border/60"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { t } = useTranslation();
  const { formatDateTable, formatDateTime } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const { data: organization } = useCurrentOrganization();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [leadForSuggestion, setLeadForSuggestion] = useState<Lead | null>(null);
  const [isManualProposalDialogOpen, setIsManualProposalDialogOpen] = useState(false);
  const [leadForManualProposal, setLeadForManualProposal] = useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [widgetTypeFilter, setWidgetTypeFilter] = useState("all");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { data: leads = [], isLoading } = useLeadsByOrg(currentOrganization?.id);
  const updateLeadMutation = useUpdateLead();

  // Always use live data for the selected lead so status updates reflect immediately
  const selectedLead = selectedLeadId
    ? leads.find((l) => l.id === selectedLeadId) ?? null
    : null;

  const filteredLeads = leads.filter((lead) => {
    const d = lead.data || lead;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (widgetTypeFilter !== "all" && d.widgetType !== widgetTypeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (d.firstName || "").toLowerCase().includes(q) ||
        (d.lastName || "").toLowerCase().includes(q) ||
        (d.email || "").toLowerCase().includes(q) ||
        (d.company || "").toLowerCase().includes(q) ||
        (d.message || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await updateLeadMutation.mutateAsync({
      id: leadId,
      data: { status: newStatus as Lead["data"]["status"] },
    });
  };

  const openDetailSheet = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIsDetailSheetOpen(true);
  };

  if (isLoading) return <LeadsLoadingSkeleton />;

  return (
    <div className="py-6 pr-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("leads.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("leads.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportDialog(true)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none" />
            <Input
              placeholder={t("leads.filters.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={widgetTypeFilter} onValueChange={setWidgetTypeFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="contactForm">
                {t("leads.widgetType.contactForm")}
              </SelectItem>
              <SelectItem value="invoiceRequest">
                {t("leads.widgetType.invoiceRequest")}
              </SelectItem>
              <SelectItem value="quoteRequest">
                {t("leads.widgetType.quoteRequest")}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filteredLeads.length === leads.length
              ? `${leads.length} lead${leads.length !== 1 ? "s" : ""}`
              : `${filteredLeads.length} of ${leads.length}`}
          </span>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
              statusFilter === "all"
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            )}
          >
            All
          </button>
          {STATUS_OPTIONS.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() =>
                  setStatusFilter(isActive ? "all" : status)
                }
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                  isActive ? cfg.activePill : cfg.idlePill
                )}
              >
                {t(`leads.status.${status}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Leads Table ── */}
      <Card className="overflow-hidden">
        {filteredLeads.length === 0 ? (
          <CardContent className="py-20 flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {searchTerm.trim() ||
                statusFilter !== "all" ||
                widgetTypeFilter !== "all"
                  ? "No leads match your filters"
                  : t("leads.empty.title")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm.trim() ||
                statusFilter !== "all" ||
                widgetTypeFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : t("leads.empty.noSubmissions")}
              </p>
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-medium pl-4 w-[220px]">
                  Lead
                </TableHead>
                <TableHead className="text-xs font-medium">Email</TableHead>
                <TableHead className="text-xs font-medium w-[80px]">
                  Type
                </TableHead>
                <TableHead className="text-xs font-medium">Message</TableHead>
                <TableHead className="text-xs font-medium w-[100px]">
                  Submitted
                </TableHead>
                <TableHead className="text-xs font-medium w-[110px]">
                  Status
                </TableHead>
                <TableHead className="w-[44px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const d = lead.data || lead;
                if (!lead?.id) return null;

                const fullName =
                  [d.firstName, d.lastName].filter(Boolean).join(" ") || "—";
                const initials = getInitials(
                  d.firstName || "",
                  d.lastName || ""
                );
                const avatarColor = getAvatarColor(
                  fullName + (d.email || "")
                );
                const status = ((d.status || "new") as LeadStatus);
                const statusCfg =
                  STATUS_CONFIG[status] || STATUS_CONFIG.new;
                const typeCfg =
                  WIDGET_TYPE_CONFIG[d.widgetType] || {
                    label: d.widgetType || "—",
                    badge:
                      "bg-gray-50 text-gray-600 border-gray-200",
                  };

                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer transition-colors duration-100 hover:bg-muted/40 group"
                    onClick={() => openDetailSheet(lead)}
                  >
                    {/* Lead: avatar + name + company */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-transform duration-150 group-hover:scale-105",
                            avatarColor
                          )}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {fullName}
                          </p>
                          {d.company && (
                            <p className="text-xs text-muted-foreground truncate">
                              {d.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-sm text-muted-foreground py-3 max-w-[180px]">
                      <p className="truncate">{d.email || "—"}</p>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                          typeCfg.badge
                        )}
                      >
                        {typeCfg.label}
                      </span>
                    </TableCell>

                    {/* Message preview */}
                    <TableCell className="py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {d.message ? d.message.slice(0, 90) : "—"}
                      </p>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {lead.createdAt ? formatDateTable(lead.createdAt) : "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          statusCfg.badge
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            statusCfg.dot
                          )}
                        />
                        {t(`leads.status.${status}`)}
                      </span>
                    </TableCell>

                    {/* Actions dropdown */}
                    <TableCell
                      className="py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => openDetailSheet(lead)}
                          >
                            <MessageSquare className="mr-2 h-3.5 w-3.5" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setLeadForSuggestion(lead);
                              setIsSuggestionDialogOpen(true);
                            }}
                          >
                            <Sparkles className="mr-2 h-3.5 w-3.5 text-violet-500" />
                            AI Proposal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setLeadForManualProposal(lead);
                              setIsManualProposalDialogOpen(true);
                            }}
                          >
                            <FileText className="mr-2 h-3.5 w-3.5 text-blue-500" />
                            Create Proposal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Lead Detail Sheet ── */}
      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="sm:max-w-md p-0 gap-0" side="right">
          {selectedLead && (
            <LeadDetailPanel
              lead={selectedLead}
              onStatusChange={(status) =>
                handleStatusChange(selectedLead.id, status)
              }
              onAIProposal={() => {
                setLeadForSuggestion(selectedLead);
                setIsSuggestionDialogOpen(true);
              }}
              onManualProposal={() => {
                setLeadForManualProposal(selectedLead);
                setIsManualProposalDialogOpen(true);
              }}
              isUpdating={updateLeadMutation.isPending}
              t={t}
              formatDateTime={formatDateTime}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── AI Proposal Dialog ── */}
      {leadForSuggestion && (
        <ProposalSuggestionDialog
          open={isSuggestionDialogOpen}
          onOpenChange={setIsSuggestionDialogOpen}
          leadId={leadForSuggestion.id}
          leadData={leadForSuggestion.data || leadForSuggestion}
          organizationName={organization?.name}
        />
      )}

      {/* ── Manual Proposal Dialog ── */}
      {leadForManualProposal && organization && (
        <ManualProposalDialog
          open={isManualProposalDialogOpen}
          onOpenChange={setIsManualProposalDialogOpen}
          lead={leadForManualProposal}
          organization={organization}
        />
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["leads"]}
      />
    </div>
  );
}

// ─── Manual Proposal Dialog ────────────────────────────────────────────────────

function ManualProposalDialog({
  open,
  onOpenChange,
  lead,
  organization,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  organization?: { id?: string; settings?: { defaultCurrency?: string } };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const d = lead.data || lead;

  const [proposalTitle, setProposalTitle] = useState(
    `Proposal for ${d.company || [d.firstName, d.lastName].filter(Boolean).join(" ") || "Lead"}`
  );
  const [proposalDescription, setProposalDescription] = useState(
    d.message || ""
  );
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    { description: "", qty: 1, unitPrice: 0, taxPct: 0 },
  ]);
  const [currency, setCurrency] = useState(
    organization?.settings?.defaultCurrency || "USD"
  );
  const [terms, setTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");

  const createProposalMutation = useCreateProposal();

  const handleAddItem = () => {
    setProposalItems([
      ...proposalItems,
      { description: "", qty: 1, unitPrice: 0, taxPct: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (proposalItems.length > 1) {
      setProposalItems(proposalItems.filter((_, i) => i !== index));
    }
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ProposalItem,
    value: string | number
  ) => {
    const updated = [...proposalItems];
    updated[index] = { ...updated[index], [field]: value };
    setProposalItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = proposalItems.reduce(
      (sum, item) => sum + item.qty * item.unitPrice,
      0
    );
    const taxTotal = proposalItems.reduce(
      (sum, item) =>
        sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
      0
    );
    return { subtotal, taxTotal, total: subtotal + taxTotal };
  };

  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount
    );

  const handleCreate = async () => {
    if (!proposalTitle.trim()) {
      toast.error(t("leads.messages.titleRequired"));
      return;
    }
    if (
      proposalItems.length === 0 ||
      proposalItems.some((item) => !item.description.trim())
    ) {
      toast.error(t("leads.messages.itemsRequired"));
      return;
    }
    if (!organization?.id) {
      toast.error(t("leads.messages.orgNotFound"));
      return;
    }

    const totals = calculateTotals();
    const proposalData: ProposalData = {
      organizationId: organization.id,
      leadId: lead.id,
      title: proposalTitle,
      description: proposalDescription || undefined,
      status: "DRAFT",
      items: proposalItems,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      currency,
      terms: terms || undefined,
      notes: notes || undefined,
      aiGenerated: false,
      isIncomplete: false,
    };

    try {
      const proposalId = await createProposalMutation.mutateAsync(proposalData);
      toast.success(t("leads.messages.proposalCreated"));
      onOpenChange(false);
      navigate(`/proposals/${proposalId}`);
    } catch (error) {
      toast.error(
        t("leads.messages.proposalFailed", {
          error:
            error instanceof Error ? error.message : "Unknown error",
        })
      );
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            {t("leads.proposal.title")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t("leads.proposal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("leads.proposal.proposalTitle")}
            </Label>
            <Input
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder={t("leads.proposal.proposalTitlePlaceholder")}
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("leads.proposal.descriptionLabel")}
            </Label>
            <Textarea
              value={proposalDescription}
              onChange={(e) => setProposalDescription(e.target.value)}
              placeholder={t("leads.proposal.descriptionPlaceholder")}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Currency + Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("leads.proposal.currency")}
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {getAllCurrencyCodes().map((code) => (
                    <SelectItem key={code} value={code} className="text-sm">
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("leads.proposal.paymentTerms")}
              </Label>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder={t("leads.proposal.paymentTermsPlaceholder")}
                className="text-sm"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("leads.proposal.items")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("leads.proposal.addItem")}
              </Button>
            </div>

            {/* Items header */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-12 gap-0 bg-muted/40 px-3 py-2 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Unit $</span>
                <span className="col-span-2 text-right">Tax %</span>
                <span className="col-span-1" />
              </div>

              {proposalItems.map((item, index) => {
                const lineTotal =
                  item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100);
                return (
                  <div
                    key={index}
                    className={cn(
                      "grid grid-cols-12 gap-2 items-center px-3 py-2.5",
                      index < proposalItems.length - 1 && "border-b"
                    )}
                  >
                    <div className="col-span-5">
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateItem(index, "description", e.target.value)
                        }
                        placeholder={t(
                          "leads.proposal.itemDescriptionPlaceholder"
                        )}
                        className="text-sm h-8 border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.qty}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            "qty",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="text-sm h-8 text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="text-sm h-8 text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.taxPct || 0}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            "taxPct",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="text-sm h-8 text-right"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {proposalItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={t("leads.proposal.removeItem")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals summary */}
          <div className="rounded-xl bg-muted/50 border p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("leads.proposal.subtotal")}
              </span>
              <span className="font-medium tabular-nums">
                {fmt(totals.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("leads.proposal.taxTotal")}
              </span>
              <span className="font-medium tabular-nums">
                {fmt(totals.taxTotal)}
              </span>
            </div>
            <Separator className="my-1" />
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {t("leads.proposal.total")}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {fmt(totals.total)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("leads.proposal.notes")}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("leads.proposal.notesPlaceholder")}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-sm"
          >
            {t("leads.proposal.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createProposalMutation.isPending}
            className="text-sm"
          >
            {createProposalMutation.isPending
              ? t("leads.proposal.creating")
              : t("leads.proposal.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
