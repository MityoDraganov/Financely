import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  FileText,
  Plus,
  CalendarDays,
  CircleDollarSign,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Separator } from "@/components/ui/separator";
import { useOpportunity, useUpdateOpportunity } from "@/hooks/repository-hooks/use-opportunities";
import { useProposalsByOpportunity } from "@/hooks/repository-hooks/use-proposals";
import { useCreateProposal } from "@/hooks/repository-hooks/use-proposals";
import { useLead } from "@/hooks/repository-hooks/use-leads";
import { OPPORTUNITY_STAGES, OpportunityStage } from "@/core";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { normalizeProposalStatus } from "@/core";
import { toast } from "sonner";
import { formatProposalCurrency } from "@/utils/proposal-currency";

const STAGE_ORDER: OpportunityStage[] = [
  OPPORTUNITY_STAGES.PROSPECTING,
  OPPORTUNITY_STAGES.QUALIFICATION,
  OPPORTUNITY_STAGES.PROPOSAL,
  OPPORTUNITY_STAGES.NEGOTIATION,
  OPPORTUNITY_STAGES.WON,
  OPPORTUNITY_STAGES.LOST,
];

const STAGE_BADGE: Record<OpportunityStage, string> = {
  prospecting: "bg-sky-50 text-sky-700 border-sky-200",
  qualification: "bg-violet-50 text-violet-700 border-violet-200",
  proposal: "bg-amber-50 text-amber-700 border-amber-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-stone-50 text-stone-500 border-stone-200",
};

const PROPOSAL_STATUS_BADGE: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  INVOICED: "bg-purple-100 text-purple-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-yellow-100 text-yellow-800",
};

function formatValue(value?: number, currency?: string) {
  if (!value) return "—";
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

export default function OpportunityDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganizationContext();

  const { data: opportunity, isLoading } = useOpportunity(id);
  const { data: proposals = [] } = useProposalsByOpportunity(id);
  const { data: sourceLead } = useLead(opportunity?.leadId);
  const updateOpportunity = useUpdateOpportunity();
  const createProposal = useCreateProposal();

  const [notes, setNotes] = useState<string | undefined>(undefined);
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");

  const displayNotes = notes !== undefined ? notes : (opportunity?.notes ?? "");

  function handleStageChange(stage: string) {
    if (!id) return;
    updateOpportunity.mutate(
      { id, data: { stage: stage as OpportunityStage } },
      { onSuccess: () => toast.success(t("opportunities.stageUpdated", "Stage updated")) },
    );
  }

  function handleNotesBlur() {
    if (!id || notes === undefined) return;
    updateOpportunity.mutate({ id, data: { notes } });
  }

  async function handleCreateProposal() {
    if (!proposalTitle.trim() || !currentOrganization?.id || !id) return;
    const proposalId = await createProposal.mutateAsync({
      organizationId: currentOrganization.id,
      opportunityId: id,
      leadId: opportunity?.leadId,
      title: proposalTitle.trim(),
      status: "CREATED",
      items: [],
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      currency: opportunity?.currency ?? "USD",
      aiGenerated: false,
      isIncomplete: false,
    });
    setIsCreateProposalOpen(false);
    setProposalTitle("");
    if (typeof proposalId === "string") {
      navigate(`/proposals/${proposalId}`);
    } else if (proposalId && typeof proposalId === "object" && "id" in proposalId) {
      navigate(`/proposals/${(proposalId as { id: string }).id}`);
    }
  }

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6 max-w-3xl">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="py-6 pr-6 max-w-3xl">
        <Link to="/opportunities" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          {t("opportunities.back", "Opportunities")}
        </Link>
        <p className="text-muted-foreground">{t("opportunities.notFound", "Opportunity not found.")}</p>
      </div>
    );
  }

  const stageLabel: Record<OpportunityStage, string> = {
    prospecting: t("opportunities.stages.prospecting", "Prospecting"),
    qualification: t("opportunities.stages.qualification", "Qualification"),
    proposal: t("opportunities.stages.proposal", "Proposal"),
    negotiation: t("opportunities.stages.negotiation", "Negotiation"),
    won: t("opportunities.stages.won", "Won"),
    lost: t("opportunities.stages.lost", "Lost"),
  };

  return (
    <div className="py-6 pr-6 space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        to="/opportunities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("opportunities.back", "Opportunities")}
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
          </div>
          <Select value={opportunity.stage} onValueChange={handleStageChange}>
            <SelectTrigger className={`w-40 text-xs font-medium border ${STAGE_BADGE[opportunity.stage]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {stageLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {opportunity.description && (
          <p className="text-sm text-muted-foreground">{opportunity.description}</p>
        )}

        {/* Metrics row */}
        <div className="flex flex-wrap gap-4 pt-1">
          {opportunity.estimatedValue !== undefined && (
            <div className="flex items-center gap-1.5 text-sm">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatValue(opportunity.estimatedValue, opportunity.currency)}</span>
              {opportunity.probability !== undefined && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 ml-1">
                  {opportunity.probability}%
                </Badge>
              )}
            </div>
          )}
          {opportunity.expectedCloseDate && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{t("opportunities.closeBy", "Close by")} {opportunity.expectedCloseDate}</span>
            </div>
          )}
          {opportunity.assignedToUserId && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{opportunity.assignedToUserId}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Proposals section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("opportunities.proposals", "Proposals")}
              {proposals.length > 0 && (
                <Badge variant="secondary">{proposals.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateProposalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("opportunities.createProposal", "New Proposal")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("opportunities.noProposals", "No proposals yet. Create one to begin scoping this deal.")}
            </p>
          ) : (
            proposals.map((proposal) => {
              const status = normalizeProposalStatus(proposal.status);
              return (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/proposals/${proposal.id}`)}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatProposalCurrency(proposal.total, proposal.currency)}
                    </p>
                  </div>
                  <Badge className={`text-xs ${PROPOSAL_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-800"}`}>
                    {status}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Source lead */}
      {sourceLead && (() => {
        const ld = sourceLead.data || sourceLead;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("opportunities.sourceLead", "Source Lead")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {(ld.firstName || ld.lastName) && (
                  <p className="font-medium">
                    {[ld.firstName, ld.lastName].filter(Boolean).join(" ")}
                  </p>
                )}
                {ld.email && (
                  <p className="text-muted-foreground">{ld.email}</p>
                )}
                {ld.company && (
                  <p className="text-muted-foreground">{ld.company}</p>
                )}
                {ld.message && (
                  <p className="text-sm mt-2 p-2 bg-muted rounded">{ld.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("opportunities.notes", "Notes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="resize-none text-sm min-h-[100px]"
            placeholder={t("opportunities.notesPlaceholder", "Add internal notes about this opportunity...")}
            value={displayNotes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
          />
        </CardContent>
      </Card>

      {/* Create Proposal Dialog */}
      <Dialog open={isCreateProposalOpen} onOpenChange={setIsCreateProposalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("opportunities.newProposalTitle", "New Proposal")}</DialogTitle>
            <DialogDescription>
              {t("opportunities.newProposalDesc", "Create a proposal for this opportunity. You can add line items after creation.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-title">{t("proposals.title", "Title")}</Label>
              <Input
                id="proposal-title"
                placeholder={t("opportunities.proposalTitlePlaceholder", "e.g. Website Redesign Proposal")}
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProposal()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateProposalOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreateProposal}
              disabled={!proposalTitle.trim() || createProposal.isPending}
            >
              {createProposal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("opportunities.createProposal", "Create Proposal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
