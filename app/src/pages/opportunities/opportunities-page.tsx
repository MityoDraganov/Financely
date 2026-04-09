import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useOpportunitiesByOrg, useUpdateOpportunity } from "@/hooks/repository-hooks/use-opportunities";
import { Opportunity, OPPORTUNITY_STAGES, OpportunityStage } from "@/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STAGE_ORDER: OpportunityStage[] = [
  OPPORTUNITY_STAGES.PROSPECTING,
  OPPORTUNITY_STAGES.QUALIFICATION,
  OPPORTUNITY_STAGES.PROPOSAL,
  OPPORTUNITY_STAGES.NEGOTIATION,
  OPPORTUNITY_STAGES.WON,
  OPPORTUNITY_STAGES.LOST,
];

const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospecting: "bg-sky-50 border-sky-200",
  qualification: "bg-violet-50 border-violet-200",
  proposal: "bg-amber-50 border-amber-200",
  negotiation: "bg-orange-50 border-orange-200",
  won: "bg-emerald-50 border-emerald-200",
  lost: "bg-stone-50 border-stone-200",
};

const STAGE_HEADER_COLORS: Record<OpportunityStage, string> = {
  prospecting: "text-sky-700",
  qualification: "text-violet-700",
  proposal: "text-amber-700",
  negotiation: "text-orange-700",
  won: "text-emerald-700",
  lost: "text-stone-500",
};

function formatValue(value?: number, currency?: string) {
  if (!value) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? ""}${value.toLocaleString()}`;
  }
}

function daysOpen(createdAt?: string) {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  isDragging?: boolean;
}

function OpportunityCard({ opportunity, isDragging }: OpportunityCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: opportunity.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
      onClick={() => navigate(`/opportunities/${opportunity.id}`)}
    >
      <Card className="border shadow-sm hover:shadow-md transition-shadow bg-white">
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium leading-tight line-clamp-2">{opportunity.title}</p>
          {formatValue(opportunity.estimatedValue, opportunity.currency) && (
            <p className="text-xs font-semibold text-foreground">
              {formatValue(opportunity.estimatedValue, opportunity.currency)}
            </p>
          )}
          <div className="flex items-center justify-between">
            {opportunity.probability !== undefined && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {opportunity.probability}%
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {daysOpen(opportunity.createdAt)}d
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  stageLabel: string;
  activeId: string | null;
}

function KanbanColumn({ stage, opportunities, stageLabel, activeId }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage });
  const totalValue = opportunities.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);
  const hasValue = opportunities.some((o) => o.estimatedValue);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 rounded-lg border-2 flex flex-col max-h-[calc(100vh-220px)] ${STAGE_COLORS[stage]}`}
    >
      <div className="p-3 border-b border-current/10">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wide ${STAGE_HEADER_COLORS[stage]}`}>
            {stageLabel}
          </span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {opportunities.length}
          </Badge>
        </div>
        {hasValue && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatValue(totalValue, opportunities.find((o) => o.currency)?.currency)}
          </p>
        )}
      </div>
      <SortableContext
        items={opportunities.map((o) => o.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isDragging={activeId === opp.id}
            />
          ))}
          {opportunities.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
              No opportunities
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function OpportunitiesPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useOrganizationContext();
  const { data: opportunities = [], isLoading } = useOpportunitiesByOrg(currentOrganization?.id);
  const updateOpportunity = useUpdateOpportunity();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byStage = STAGE_ORDER.reduce<Record<OpportunityStage, Opportunity[]>>(
    (acc, stage) => {
      acc[stage] = opportunities.filter((o) => o.stage === stage);
      return acc;
    },
    {} as Record<OpportunityStage, Opportunity[]>,
  );

  const stageLabels: Record<OpportunityStage, string> = {
    prospecting: t("opportunities.stages.prospecting", "Prospecting"),
    qualification: t("opportunities.stages.qualification", "Qualification"),
    proposal: t("opportunities.stages.proposal", "Proposal"),
    negotiation: t("opportunities.stages.negotiation", "Negotiation"),
    won: t("opportunities.stages.won", "Won"),
    lost: t("opportunities.stages.lost", "Lost"),
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const destinationStage = STAGE_ORDER.find((stage) =>
      stage === over.id || byStage[stage]?.some((o) => o.id === over.id),
    );

    const opp = opportunities.find((o) => o.id === active.id);
    if (!opp || !destinationStage || opp.stage === destinationStage) return;

    updateOpportunity.mutate({ id: opp.id, data: { stage: destinationStage } });
  }

  const totalPipelineValue = opportunities
    .filter((o) => o.stage !== "won" && o.stage !== "lost")
    .reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);

  const activeOpportunity = activeId ? opportunities.find((o) => o.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("opportunities.title", "Opportunities")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("opportunities.subtitle", "Track active deals from qualification to close")}
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="flex-shrink-0 w-64 h-64 rounded-lg border-2 bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 pr-6 flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("opportunities.title", "Opportunities")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("opportunities.subtitle", "Track active deals from qualification to close")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("opportunities.pipelineValue", "Pipeline value")}</p>
          <p className="text-lg font-semibold">{formatValue(totalPipelineValue) ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{opportunities.length} {t("opportunities.total", "total")}</span>
        <span>·</span>
        <span>{byStage.won.length} {t("opportunities.stages.won", "Won")}</span>
        <span>·</span>
        <span>{byStage.lost.length} {t("opportunities.stages.lost", "Lost")}</span>
        <span className="text-xs ml-2">{t("opportunities.convertHint", "Convert leads to create opportunities")}</span>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              opportunities={byStage[stage]}
              stageLabel={stageLabels[stage]}
              activeId={activeId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeOpportunity && (
            <div className="w-64 rotate-2 opacity-95">
              <Card className="border shadow-lg bg-white">
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium leading-tight line-clamp-2">
                    {activeOpportunity.title}
                  </p>
                  {formatValue(activeOpportunity.estimatedValue, activeOpportunity.currency) && (
                    <p className="text-xs font-semibold">
                      {formatValue(activeOpportunity.estimatedValue, activeOpportunity.currency)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
