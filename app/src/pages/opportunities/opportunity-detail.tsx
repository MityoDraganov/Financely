import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit2,
  Save,
  X,
  FileText,
  Receipt,
  ChevronRight,
  CircleDot,
  Plus,
  ExternalLink,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOpportunity,
  useUpdateOpportunity,
} from "@/hooks/repository-hooks/use-opportunities";
import { useProposalsByOpportunity } from "@/hooks/repository-hooks/use-proposals";
import { useInvoice } from "@/hooks/repository-hooks/use-invoices";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STATUSES,
  Opportunity,
  OpportunityData,
  OpportunityStage,
  Proposal,
  defaultProbabilityForStage,
} from "@/core";
import { toast } from "sonner";
import { getAllCurrencyCodes } from "@/utils/currencies";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_ORDER: OpportunityStage[] = [
  OPPORTUNITY_STAGES.NEW_QUALIFIED,
  OPPORTUNITY_STAGES.DISCOVERY,
  OPPORTUNITY_STAGES.PROPOSAL_SENT,
  OPPORTUNITY_STAGES.NEGOTIATION,
  OPPORTUNITY_STAGES.WON,
  OPPORTUNITY_STAGES.LOST,
];

const STAGE_CONFIG: Record<OpportunityStage, { label: string; dot: string; ring: string }> = {
  NEW_QUALIFIED: { label: "New / Qualified", dot: "bg-slate-400", ring: "ring-slate-400" },
  DISCOVERY:     { label: "Discovery",        dot: "bg-blue-400",  ring: "ring-blue-400"  },
  PROPOSAL_SENT: { label: "Proposal Sent",    dot: "bg-amber-400", ring: "ring-amber-400" },
  NEGOTIATION:   { label: "Negotiation",      dot: "bg-orange-400",ring: "ring-orange-400"},
  WON:           { label: "Won",              dot: "bg-emerald-500",ring: "ring-emerald-500"},
  LOST:          { label: "Lost",             dot: "bg-red-400",   ring: "ring-red-400"   },
};

const PROPOSAL_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  CREATED:  { badge: "bg-slate-100 text-slate-700 border-slate-200",  label: "Draft"     },
  SENT:     { badge: "bg-blue-50 text-blue-700 border-blue-200",      label: "Sent"      },
  ACCEPTED: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Accepted"},
  INVOICED: { badge: "bg-violet-50 text-violet-700 border-violet-200",label: "Invoiced"  },
  REJECTED: { badge: "bg-red-50 text-red-700 border-red-200",         label: "Rejected"  },
  EXPIRED:  { badge: "bg-stone-100 text-stone-600 border-stone-200",  label: "Expired"   },
};

const INVOICE_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  unsent:    { badge: "bg-slate-100 text-slate-700 border-slate-200", label: "Unsent"    },
  sent:      { badge: "bg-blue-50 text-blue-700 border-blue-200",     label: "Sent"      },
  paid:      { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Paid" },
  cancelled: { badge: "bg-red-50 text-red-700 border-red-200",        label: "Cancelled" },
  draft:     { badge: "bg-stone-100 text-stone-600 border-stone-200", label: "Draft"     },
};

const formatAmount = (amount: number | undefined, currency: string) => {
  if (amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ─── Stage stepper ────────────────────────────────────────────────────────────

function StageStepper({
  current,
  isOpen,
  onChange,
}: {
  current: OpportunityStage;
  isOpen: boolean;
  onChange: (stage: OpportunityStage) => void;
}) {
  const activeStages = STAGE_ORDER.filter(
    (s) => s !== OPPORTUNITY_STAGES.WON && s !== OPPORTUNITY_STAGES.LOST
  );
  const currentIdx = STAGE_ORDER.indexOf(current);
  const isTerminal =
    current === OPPORTUNITY_STAGES.WON || current === OPPORTUNITY_STAGES.LOST;

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {activeStages.map((stage, i) => {
        const idx = STAGE_ORDER.indexOf(stage);
        const isActive = stage === current;
        const isPast = !isTerminal && idx < currentIdx;
        const cfg = STAGE_CONFIG[stage];
        return (
          <div key={stage} className="flex items-center">
            <button
              onClick={() => isOpen && onChange(stage)}
              disabled={!isOpen}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                isActive
                  ? `${cfg.dot.replace("bg-", "bg-")} ring-2 ring-offset-1 ${cfg.ring} border-transparent text-white`
                  : isPast
                  ? "bg-muted text-muted-foreground border-transparent"
                  : "text-muted-foreground/60 border-border/40 hover:border-border",
                isOpen ? "cursor-pointer hover:opacity-90" : "cursor-default"
              )}
              style={isActive ? { backgroundColor: undefined } : undefined}
            >
              {isActive && <span className="mr-1">✓</span>}
              {cfg.label}
            </button>
            {i < activeStages.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
      {/* Won / Lost as terminal actions */}
      {current === OPPORTUNITY_STAGES.WON && (
        <div className="ml-2 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500 text-white">
          <CheckCircle2 className="h-3 w-3" />
          Won
        </div>
      )}
      {current === OPPORTUNITY_STAGES.LOST && (
        <div className="ml-2 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-400 text-white">
          <XCircle className="h-3 w-3" />
          Lost
        </div>
      )}
    </div>
  );
}

// ─── Proposal row ─────────────────────────────────────────────────────────────

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const navigate = useNavigate();
  const { formatDateTable } = useDateFormatting();
  const statusCfg = PROPOSAL_STATUS_CONFIG[proposal.status] ?? PROPOSAL_STATUS_CONFIG.CREATED;
  const amount = proposal.total
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: proposal.currency,
        maximumFractionDigits: 0,
      }).format(proposal.total)
    : null;

  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors group"
      onClick={() => navigate(`/proposals/${proposal.id}`)}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{proposal.title}</p>
          {proposal.createdAt && (
            <p className="text-xs text-muted-foreground">{formatDateTable(proposal.createdAt)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amount && <span className="text-xs font-medium">{amount}</span>}
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs border",
          statusCfg.badge
        )}>
          {statusCfg.label}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// ─── Invoice row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoiceId }: { invoiceId: string }) {
  const navigate = useNavigate();
  const { data: invoice } = useInvoice(invoiceId);
  const { formatDateTable } = useDateFormatting();

  if (!invoice) {
    return (
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border bg-muted/30">
        <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const status = invoice.status ?? "unsent";
  const statusCfg = INVOICE_STATUS_CONFIG[status] ?? INVOICE_STATUS_CONFIG.unsent;
  const invoiceNumber = invoice.data?.invoiceNumber as string | undefined;
  const total = invoice.data?.total as number | undefined;

  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors group"
      onClick={() => navigate(`/invoices/${invoiceId}`)}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {invoiceNumber ? `Invoice #${invoiceNumber}` : "Invoice"}
          </p>
          {invoice.createdAt && (
            <p className="text-xs text-muted-foreground">{formatDateTable(invoice.createdAt as string)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {total !== undefined && (
          <span className="text-xs font-medium">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: (invoice.data?.currency as string) ?? "USD",
              maximumFractionDigits: 0,
            }).format(total)}
          </span>
        )}
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs border",
          statusCfg.badge
        )}>
          {statusCfg.label}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// ─── Funnel panel ─────────────────────────────────────────────────────────────

function FunnelPanel({ opportunity }: { opportunity: Opportunity }) {
  const navigate = useNavigate();
  const { data: proposals = [], isLoading: loadingProposals } = useProposalsByOpportunity(opportunity.id);

  // Also collect any proposal IDs referenced on the opportunity that aren't
  // yet linked via opportunityId (legacy data before the field existed)
  const linkedIds = new Set(proposals.map((p) => p.id));
  const unlinkedProposalIds = (opportunity.proposalIds ?? []).filter(
    (id) => !linkedIds.has(id)
  );

  const hasProposals = proposals.length > 0 || unlinkedProposalIds.length > 0;
  const hasInvoices = (opportunity.invoiceIds ?? []).length > 0;

  return (
    <div className="space-y-1">
      {/* Lead */}
      {opportunity.leadId && (
        <>
          <div className="flex items-center gap-2 py-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-7 w-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <CircleDot className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source Lead</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
              onClick={() => navigate("/leads")}
            >
              View lead
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <Separator />
        </>
      )}

      {/* Proposals section */}
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <FileText className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proposals
              {hasProposals && (
                <span className="ml-1.5 text-foreground font-medium normal-case text-xs">
                  ({proposals.length + unlinkedProposalIds.length})
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => navigate(`/cases/${opportunity.id}`)}
          >
            <Plus className="h-3 w-3" />
            New proposal
          </Button>
        </div>

        {loadingProposals ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : hasProposals ? (
          <div className="space-y-1.5">
            {proposals.map((p) => <ProposalRow key={p.id} proposal={p} />)}
            {unlinkedProposalIds.map((pid) => (
              <div
                key={pid}
                className="flex items-center gap-2 py-2.5 px-3 rounded-lg border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
                onClick={() => navigate(`/proposals/${pid}`)}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground truncate">{pid}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-2 pl-9">No proposals yet</p>
        )}
      </div>

      <Separator />

      {/* Invoices section */}
      <div className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <Receipt className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Invoices
            {hasInvoices && (
              <span className="ml-1.5 text-foreground font-medium normal-case text-xs">
                ({opportunity.invoiceIds!.length})
              </span>
            )}
          </p>
        </div>

        {hasInvoices ? (
          <div className="space-y-1.5">
            {opportunity.invoiceIds!.map((iid) => (
              <InvoiceRow key={iid} invoiceId={iid} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-2 pl-9">
            No invoices yet — convert a proposal to create one
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const updateOpportunity = useUpdateOpportunity();
  const currencies = getAllCurrencyCodes();

  const { data: opportunity, isLoading } = useOpportunity(id);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OpportunityData>>({});

  const startEditing = () => {
    if (!opportunity) return;
    setEditForm({
      title: opportunity.title,
      companyName: opportunity.companyName,
      summary: opportunity.summary,
      amount: opportunity.amount,
      currency: opportunity.currency,
      probability: opportunity.probability,
      expectedCloseDate: opportunity.expectedCloseDate,
      nextStep: opportunity.nextStep,
      nextStepDueAt: opportunity.nextStepDueAt,
      notes: opportunity.notes,
      lostReason: opportunity.lostReason,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!id || !editForm.title?.trim()) {
      toast.error(t("opportunities.create.titleRequired"));
      return;
    }
    try {
      await updateOpportunity.mutateAsync({ id, data: editForm });
      toast.success(t("opportunities.detail.saveSuccess"));
      setIsEditing(false);
    } catch {
      toast.error(t("opportunities.detail.saveError"));
    }
  };

  const handleStageChange = async (stage: OpportunityStage) => {
    if (!id) return;
    const updates: Partial<OpportunityData> = {
      stage,
      probability: defaultProbabilityForStage(stage),
    };
    if (stage === OPPORTUNITY_STAGES.WON) {
      updates.status = OPPORTUNITY_STATUSES.WON;
      updates.wonAt = new Date().toISOString();
    } else if (stage === OPPORTUNITY_STAGES.LOST) {
      updates.status = OPPORTUNITY_STATUSES.LOST;
      updates.lostAt = new Date().toISOString();
    } else {
      updates.status = OPPORTUNITY_STATUSES.OPEN;
    }
    try {
      await updateOpportunity.mutateAsync({ id, data: updates });
    } catch {
      toast.error(t("opportunities.detail.saveError"));
    }
  };

  const handleMarkWon = () => handleStageChange(OPPORTUNITY_STAGES.WON);
  const handleMarkLost = () => handleStageChange(OPPORTUNITY_STAGES.LOST);

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="py-6 pr-6">
        <Button variant="ghost" onClick={() => navigate("/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("opportunities.detail.back")}
        </Button>
        <div className="mt-8 text-center text-muted-foreground">
          {t("opportunities.detail.notFound")}
        </div>
      </div>
    );
  }

  const isOpen = opportunity.status === OPPORTUNITY_STATUSES.OPEN;
  const stageCfg = STAGE_CONFIG[opportunity.stage];

  return (
    <div className="py-6 pr-6 space-y-5">
      {/* Back + title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" className="-ml-2 mb-1" size="sm" onClick={() => navigate("/opportunities")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {t("opportunities.detail.back")}
          </Button>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", stageCfg.dot)} />
            <h1 className="text-xl font-semibold tracking-tight">{opportunity.title}</h1>
            {opportunity.companyName && (
              <span className="text-sm text-muted-foreground">· {opportunity.companyName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-7">
          {isOpen && (
            <>
              <Button variant="outline" size="sm" onClick={handleMarkWon} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Mark Won
              </Button>
              <Button variant="outline" size="sm" onClick={handleMarkLost} className="border-red-200 text-red-600 hover:bg-red-50">
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Mark Lost
              </Button>
            </>
          )}
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={updateOpportunity.isPending}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <Card className="px-4 py-3">
        <StageStepper
          current={opportunity.stage}
          isOpen={isOpen}
          onChange={handleStageChange}
        />
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: deal details + commercial */}
        <div className="lg:col-span-2 space-y-5">
          {/* Commercial */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Commercial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm pt-0">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Value</span>
                <span className="font-semibold flex items-center gap-0.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatAmount(opportunity.amount, opportunity.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Probability</span>
                <span className="font-medium">
                  {opportunity.probability !== undefined ? `${opportunity.probability}%` : "—"}
                </span>
              </div>
              {opportunity.amount !== undefined && opportunity.probability !== undefined && (
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-muted-foreground">Weighted</span>
                  <span className="font-semibold text-emerald-600">
                    {formatAmount(
                      opportunity.amount * opportunity.probability / 100,
                      opportunity.currency
                    )}
                  </span>
                </div>
              )}
              {opportunity.expectedCloseDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Close date</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatDateTable(opportunity.expectedCloseDate)}
                  </span>
                </div>
              )}
              {opportunity.wonAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Won on</span>
                  <span className="text-emerald-600">{formatDateTable(opportunity.wonAt)}</span>
                </div>
              )}
              {opportunity.lostAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lost on</span>
                  <span className="text-red-600">{formatDateTable(opportunity.lostAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm pt-0">
              {isEditing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input
                      value={editForm.title ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input
                      value={editForm.companyName ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Summary</Label>
                    <Textarea
                      rows={2}
                      value={editForm.summary ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Value</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editForm.amount ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            amount: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Select
                        value={editForm.currency ?? "USD"}
                        onValueChange={(v) => setEditForm((f) => ({ ...f, currency: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Probability %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={editForm.probability ?? ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            probability: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Close date</Label>
                      <Input
                        type="date"
                        value={editForm.expectedCloseDate ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label>Next step</Label>
                    <Input
                      value={editForm.nextStep ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, nextStep: e.target.value }))}
                      placeholder="e.g. Send revised proposal by Friday"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next step due</Label>
                    <Input
                      type="date"
                      value={editForm.nextStepDueAt ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, nextStepDueAt: e.target.value }))}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      rows={4}
                      value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  {opportunity.status === OPPORTUNITY_STATUSES.LOST && (
                    <div className="space-y-1.5">
                      <Label>Lost reason</Label>
                      <Input
                        value={editForm.lostReason ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, lostReason: e.target.value }))}
                        placeholder="Why was this lost?"
                      />
                    </div>
                  )}
                </>
              ) : (
                <dl className="space-y-3">
                  {opportunity.summary && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Summary</dt>
                      <dd>{opportunity.summary}</dd>
                    </div>
                  )}
                  {opportunity.nextStep && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Next step
                      </dt>
                      <dd className="font-medium">{opportunity.nextStep}</dd>
                      {opportunity.nextStepDueAt && (
                        <dd className="text-muted-foreground text-xs mt-0.5">
                          Due {formatDateTable(opportunity.nextStepDueAt)}
                        </dd>
                      )}
                    </div>
                  )}
                  {opportunity.notes && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Notes</dt>
                      <dd className="whitespace-pre-wrap">{opportunity.notes}</dd>
                    </div>
                  )}
                  {opportunity.lostReason && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Lost reason</dt>
                      <dd className="text-red-600">{opportunity.lostReason}</dd>
                    </div>
                  )}
                  {!opportunity.summary && !opportunity.nextStep && !opportunity.notes && !opportunity.lostReason && (
                    <p className="text-muted-foreground italic text-xs">
                      No details yet — click Edit to add a summary, next step, or notes.
                    </p>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent className="pt-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{opportunity.createdAt ? formatDateTable(opportunity.createdAt) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{opportunity.updatedAt ? formatDateTable(opportunity.updatedAt) : "—"}</span>
              </div>
              {opportunity.source && (
                <div className="flex justify-between">
                  <span>Source</span>
                  <span className="capitalize">{opportunity.source}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: funnel panel */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Deal Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <FunnelPanel opportunity={opportunity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
