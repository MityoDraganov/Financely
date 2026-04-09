import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import {
  Search,
  TrendingUp,
  Calendar,
  DollarSign,
  Eye,
  Plus,
  Trash2,
  MoreHorizontal,
  LayoutGrid,
  List,
  FileText,
  Receipt,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useOpportunitiesByOrg,
  useCreateOpportunity,
  useDeleteOpportunity,
  useUpdateOpportunity,
} from "@/hooks/repository-hooks/use-opportunities";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STATUSES,
  Opportunity,
  OpportunityData,
  OpportunityStage,
  defaultProbabilityForStage,
} from "@/core";
import { toast } from "sonner";
import { getAllCurrencyCodes } from "@/utils/currencies";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER: OpportunityStage[] = [
  OPPORTUNITY_STAGES.NEW_QUALIFIED,
  OPPORTUNITY_STAGES.DISCOVERY,
  OPPORTUNITY_STAGES.PROPOSAL_SENT,
  OPPORTUNITY_STAGES.NEGOTIATION,
  OPPORTUNITY_STAGES.WON,
  OPPORTUNITY_STAGES.LOST,
];

const STAGE_CONFIG: Record<OpportunityStage, {
  label: string;
  column: string;
  card: string;
  dot: string;
  badge: string;
}> = {
  NEW_QUALIFIED: {
    label: "New / Qualified",
    column: "border-t-slate-400",
    card: "border-l-slate-300",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  DISCOVERY: {
    label: "Discovery",
    column: "border-t-blue-400",
    card: "border-l-blue-300",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PROPOSAL_SENT: {
    label: "Proposal Sent",
    column: "border-t-amber-400",
    card: "border-l-amber-300",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  NEGOTIATION: {
    label: "Negotiation",
    column: "border-t-orange-400",
    card: "border-l-orange-300",
    dot: "bg-orange-400",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  WON: {
    label: "Won",
    column: "border-t-emerald-500",
    card: "border-l-emerald-400",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  LOST: {
    label: "Lost",
    column: "border-t-red-400",
    card: "border-l-red-300",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
};

const formatAmount = (amount: number | undefined, currency: string) => {
  if (amount === undefined) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  onAdvance,
  onDelete,
  isAdvancing,
  isDragOverlay = false,
}: {
  opp: Opportunity;
  onAdvance: (toStage: OpportunityStage) => void;
  onDelete: () => void;
  isAdvancing: boolean;
  isDragOverlay?: boolean;
}) {
  const navigate = useNavigate();
  const cfg = STAGE_CONFIG[opp.stage];
  const currentIdx = STAGE_ORDER.indexOf(opp.stage);
  const nextStage = currentIdx < STAGE_ORDER.length - 2 ? STAGE_ORDER[currentIdx + 1] : null; // -2 to skip LOST as "next"
  const isTerminal = opp.stage === OPPORTUNITY_STAGES.WON || opp.stage === OPPORTUNITY_STAGES.LOST;
  const amountStr = formatAmount(opp.amount, opp.currency);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
    data: { stage: opp.stage },
  });

  const style = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={cn(
        "bg-card border rounded-lg p-3 group transition-shadow border-l-2",
        cfg.card,
        isDragging ? "opacity-40" : "hover:shadow-md",
        isDragOverlay && "shadow-xl rotate-1 cursor-grabbing"
      )}
      onClick={() => !isDragging && navigate(`/opportunities/${opp.id}`)}
    >
      {/* Title + drag handle + menu */}
      <div className="flex items-start justify-between gap-1 mb-2">
        {!isDragOverlay && (
          <button
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors opacity-0 group-hover:opacity-100"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{opp.title}</p>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => navigate(`/opportunities/${opp.id}`)}>
                <Eye className="mr-2 h-3.5 w-3.5" />
                View deal
              </DropdownMenuItem>
              {!isTerminal && (
                <>
                  <DropdownMenuSeparator />
                  {STAGE_ORDER.filter((s) => s !== opp.stage).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => onAdvance(s)}>
                      <span
                        className={cn("mr-2 h-2 w-2 rounded-full shrink-0 inline-block", STAGE_CONFIG[s].dot)}
                      />
                      Move to {STAGE_CONFIG[s].label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Company */}
      {opp.companyName && (
        <p className="text-xs text-muted-foreground mb-2 truncate">{opp.companyName}</p>
      )}

      {/* Meta row: amount + doc counts */}
      <div className="flex items-center gap-2 flex-wrap">
        {amountStr && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {amountStr}
          </span>
        )}
        {opp.proposalIds?.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            {opp.proposalIds.length}
          </span>
        )}
        {opp.invoiceIds?.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <Receipt className="h-3 w-3" />
            {opp.invoiceIds.length}
          </span>
        )}
        {opp.probability !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">{opp.probability}%</span>
        )}
      </div>

      {/* Advance button (non-terminal stages only) */}
      {nextStage && (
        <div
          className="mt-2 pt-2 border-t border-border/50"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full text-xs text-muted-foreground hover:text-foreground justify-between px-1"
            onClick={() => onAdvance(nextStage)}
            disabled={isAdvancing}
          >
            <span>Move to {STAGE_CONFIG[nextStage].label}</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function DroppableColumn({
  stage,
  opportunities,
  onAdvance,
  onDelete,
  advancingId,
  isDraggingOver,
}: {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  onAdvance: (id: string, toStage: OpportunityStage) => void;
  onDelete: (id: string) => void;
  advancingId: string | null;
  isDraggingOver: boolean;
}) {
  const cfg = STAGE_CONFIG[stage];
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-lg border-t-2 p-2 transition-colors",
        cfg.column,
        isDraggingOver ? "bg-muted/60 ring-2 ring-inset ring-border" : "bg-muted/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-0.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
          <span className="text-xs font-medium">{cfg.label}</span>
        </div>
        {opportunities.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{opportunities.length}</span>
        )}
      </div>

      {/* Cards */}
      <ScrollArea className="max-h-[calc(100vh-280px)]">
        <div className="space-y-2 pr-1 min-h-[60px]">
          {opportunities.length === 0 ? (
            <div className={cn(
              "py-6 text-center text-xs select-none rounded-md transition-colors",
              isDraggingOver ? "text-muted-foreground bg-muted/40" : "text-muted-foreground/40"
            )}>
              {isDraggingOver ? "Drop here" : "Empty"}
            </div>
          ) : (
            opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                onAdvance={(toStage) => onAdvance(opp.id, toStage)}
                onDelete={() => onDelete(opp.id)}
                isAdvancing={advancingId === opp.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  opportunities,
  onAdvance,
  onDelete,
  advancingId,
}: {
  opportunities: Opportunity[];
  onAdvance: (id: string, toStage: OpportunityStage) => void;
  onDelete: (id: string) => void;
  advancingId: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<OpportunityStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const byStage = STAGE_ORDER.reduce<Record<string, Opportunity[]>>((acc, stage) => {
    acc[stage] = opportunities.filter((o) => o.stage === stage);
    return acc;
  }, {});

  const activeOpp = activeId ? opportunities.find((o) => o.id === activeId) ?? null : null;

  const totalValue = opportunities
    .filter((o) => o.stage !== OPPORTUNITY_STAGES.LOST && o.amount !== undefined)
    .reduce((sum, o) => sum + (o.amount ?? 0), 0);

  const wonValue = opportunities
    .filter((o) => o.stage === OPPORTUNITY_STAGES.WON && o.amount !== undefined)
    .reduce((sum, o) => sum + (o.amount ?? 0), 0);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: { over: { id: string | number } | null }) => {
    setOverStage((event.over?.id as OpportunityStage) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverStage(null);
    if (!over) return;
    const toStage = over.id as OpportunityStage;
    const fromStage = (active.data.current as { stage: OpportunityStage }).stage;
    if (toStage !== fromStage) {
      onAdvance(active.id as string, toStage);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Pipeline summary */}
        {opportunities.length > 0 && (
          <div className="flex items-center gap-6 text-sm px-0.5">
            <div>
              <span className="text-muted-foreground">Pipeline value </span>
              <span className="font-semibold">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalValue)}
              </span>
            </div>
            {wonValue > 0 && (
              <div>
                <span className="text-muted-foreground">Won </span>
                <span className="font-semibold text-emerald-600">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(wonValue)}
                </span>
              </div>
            )}
            <div className="ml-auto text-muted-foreground">
              {opportunities.length} deal{opportunities.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {/* Columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {STAGE_ORDER.map((stage) => (
            <DroppableColumn
              key={stage}
              stage={stage}
              opportunities={byStage[stage]}
              onAdvance={onAdvance}
              onDelete={onDelete}
              advancingId={advancingId}
              isDraggingOver={overStage === stage && activeId !== null}
            />
          ))}
        </div>
      </div>

      {/* Floating drag preview */}
      <DragOverlay dropAnimation={null}>
        {activeOpp && (
          <OpportunityCard
            opp={activeOpp}
            onAdvance={() => {}}
            onDelete={() => {}}
            isAdvancing={false}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

interface CreateOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

function CreateOpportunityDialog({ open, onOpenChange, organizationId }: CreateOpportunityDialogProps) {
  const { t } = useTranslation();
  const currencies = getAllCurrencyCodes();
  const createOpportunity = useCreateOpportunity();

  const [form, setForm] = useState({
    title: "",
    companyName: "",
    amount: "",
    currency: "USD",
    expectedCloseDate: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error(t("opportunities.create.titleRequired"));
      return;
    }

    const data: OpportunityData = {
      organizationId,
      title: form.title.trim(),
      companyName: form.companyName.trim() || undefined,
      amount: form.amount ? parseFloat(form.amount) : undefined,
      currency: form.currency,
      expectedCloseDate: form.expectedCloseDate || undefined,
      notes: form.notes.trim() || undefined,
      stage: OPPORTUNITY_STAGES.NEW_QUALIFIED,
      status: OPPORTUNITY_STATUSES.OPEN,
      probability: defaultProbabilityForStage(OPPORTUNITY_STAGES.NEW_QUALIFIED),
      proposalIds: [],
      invoiceIds: [],
      tags: [],
      source: "manual",
    };

    try {
      await createOpportunity.mutateAsync(data);
      toast.success(t("opportunities.create.success"));
      onOpenChange(false);
      setForm({ title: "", companyName: "", amount: "", currency: "USD", expectedCloseDate: "", notes: "" });
    } catch (err) {
      console.error("[createOpportunity]", err);
      toast.error(t("opportunities.create.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("opportunities.create.title")}</DialogTitle>
          <DialogDescription>{t("opportunities.create.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("opportunities.fields.title")} *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("opportunities.fields.titlePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("opportunities.fields.companyName")}</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              placeholder={t("opportunities.fields.companyNamePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("opportunities.fields.amount")}</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("opportunities.fields.currency")}</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("opportunities.fields.expectedCloseDate")}</Label>
            <Input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("opportunities.fields.notes")}</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("opportunities.fields.notesPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={createOpportunity.isPending}>
            {createOpportunity.isPending ? t("opportunities.create.creating") : t("opportunities.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const navigate = useNavigate();
  const deleteOpportunity = useDeleteOpportunity();
  const updateOpportunity = useUpdateOpportunity();

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const orgId = currentOrganization?.id;
  const { data: opportunities = [], isLoading } = useOpportunitiesByOrg(orgId);

  const filtered = opportunities.filter((opp) => {
    if (stageFilter !== "all" && opp.stage !== stageFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        opp.title.toLowerCase().includes(q) ||
        (opp.companyName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAdvanceStage = async (id: string, toStage: OpportunityStage) => {
    setAdvancingId(id);
    try {
      await updateOpportunity.mutateAsync({
        id,
        data: {
          stage: toStage,
          status:
            toStage === OPPORTUNITY_STAGES.WON
              ? OPPORTUNITY_STATUSES.WON
              : toStage === OPPORTUNITY_STAGES.LOST
              ? OPPORTUNITY_STATUSES.LOST
              : OPPORTUNITY_STATUSES.OPEN,
          probability: defaultProbabilityForStage(toStage),
        },
      });
    } catch {
      toast.error("Failed to update stage");
    } finally {
      setAdvancingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOpportunity.mutateAsync(id);
      toast.success(t("opportunities.delete.success"));
    } catch {
      toast.error(t("opportunities.delete.error"));
    }
  };

  return (
    <div className="py-6 pr-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("opportunities.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("opportunities.subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("opportunities.newOpportunity")}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none" />
          <Input
            placeholder={t("opportunities.filters.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {view === "list" && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder={t("opportunities.filters.allStages")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("opportunities.filters.allStages")}</SelectItem>
              {STAGE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => setView("board")}
            className={cn(
              "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
              view === "board"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
              view === "list"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          {t("opportunities.loading")}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{t("opportunities.empty.title")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("opportunities.empty.getStarted")}</p>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("opportunities.newOpportunity")}
          </Button>
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          opportunities={filtered}
          onAdvance={handleAdvanceStage}
          onDelete={handleDelete}
          advancingId={advancingId}
        />
      ) : (
        /* List view */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("opportunities.table.title")}</CardTitle>
            <CardDescription>
              {filtered.length === opportunities.length
                ? t("opportunities.table.showingAll", { count: opportunities.length })
                : t("opportunities.table.showing", { count: filtered.length, total: opportunities.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No opportunities match your filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-medium pl-4">{t("opportunities.table.titleHeader")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("opportunities.table.company")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("opportunities.table.stage")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("opportunities.table.amount")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("opportunities.table.probability")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("opportunities.table.closeDate")}</TableHead>
                    <TableHead className="w-[44px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((opp) => {
                    const cfg = STAGE_CONFIG[opp.stage];
                    return (
                      <TableRow
                        key={opp.id}
                        className="cursor-pointer hover:bg-muted/40 group"
                        onClick={() => navigate(`/opportunities/${opp.id}`)}
                      >
                        <TableCell className="pl-4 py-3 font-medium text-sm">{opp.title}</TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {opp.companyName ?? "—"}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
                            cfg.badge
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {opp.amount !== undefined ? (
                            <span className="flex items-center gap-0.5">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              {formatAmount(opp.amount, opp.currency)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {opp.probability !== undefined ? `${opp.probability}%` : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {opp.expectedCloseDate ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTable(opp.expectedCloseDate)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => navigate(`/opportunities/${opp.id}`)}>
                                <Eye className="mr-2 h-3.5 w-3.5" />
                                {t("opportunities.actions.view")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(opp.id)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {t("opportunities.actions.delete")}
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
          </CardContent>
        </Card>
      )}

      {orgId && (
        <CreateOpportunityDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          organizationId={orgId}
        />
      )}
    </div>
  );
}
