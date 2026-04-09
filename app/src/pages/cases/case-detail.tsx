import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import {
  COMMERCIAL_CASE_STAGES,
  canTransitionCommercialCaseStage,
  type CommercialCaseStage,
  type ProposalItem,
} from "@/core";
import {
  useCommercialCase,
  useCommercialCaseEvents,
  useUpdateCommercialCase,
} from "@/hooks/repository-hooks/use-commercial-cases";
import { useProposalsByCommercialCase } from "@/hooks/repository-hooks/use-proposals";
import { useInvoicesByCommercialCase } from "@/hooks/repository-hooks/use-invoices";
import {
  useAdvanceCommercialCaseStageFn,
  useCreateProposalForCaseFn,
  useOverrideCommercialCaseStageFn,
} from "@/hooks/service-hooks/use-commercial-case-functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CASE_STAGE_ORDER: CommercialCaseStage[] = [
  COMMERCIAL_CASE_STAGES.INTAKE,
  COMMERCIAL_CASE_STAGES.QUALIFIED,
  COMMERCIAL_CASE_STAGES.SCOPED,
  COMMERCIAL_CASE_STAGES.PROPOSAL_DRAFT,
  COMMERCIAL_CASE_STAGES.PROPOSAL_SENT,
  COMMERCIAL_CASE_STAGES.NEGOTIATION,
  COMMERCIAL_CASE_STAGES.WON,
  COMMERCIAL_CASE_STAGES.INVOICED,
  COMMERCIAL_CASE_STAGES.PAID,
  COMMERCIAL_CASE_STAGES.LOST,
];

export default function CaseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: commercialCase, isLoading } = useCommercialCase(id);
  const { data: caseEvents = [] } = useCommercialCaseEvents(id);
  const { data: proposals = [] } = useProposalsByCommercialCase(id);
  const { data: invoices = [] } = useInvoicesByCommercialCase(id);
  const updateCommercialCase = useUpdateCommercialCase();
  const advanceStage = useAdvanceCommercialCaseStageFn();
  const overrideStage = useOverrideCommercialCaseStageFn();
  const createProposalForCase = useCreateProposalForCaseFn();

  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalCurrency, setProposalCurrency] = useState("USD");
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    { description: "", qty: 1, unitPrice: 0, taxPct: 0 },
  ]);

  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideToStage, setOverrideToStage] = useState<CommercialCaseStage | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const nextStage = useMemo(() => {
    if (!commercialCase) return null;
    const index = CASE_STAGE_ORDER.indexOf(commercialCase.stage);
    if (index < 0 || index >= CASE_STAGE_ORDER.length - 1) return null;
    return CASE_STAGE_ORDER[index + 1];
  }, [commercialCase]);

  if (isLoading) {
    return <div className="py-6 pr-6 text-sm text-muted-foreground">Loading case...</div>;
  }

  if (!commercialCase) {
    return (
      <div className="py-6 pr-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/cases")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to cases
        </Button>
        <div className="text-sm text-muted-foreground">Case not found.</div>
      </div>
    );
  }

  const handleAdvance = async () => {
    if (!nextStage) return;
    try {
      await advanceStage.mutateAsync({
        organizationId: commercialCase.organizationId,
        commercialCaseId: commercialCase.id,
        toStage: nextStage,
      });
      toast.success(`Case moved to ${nextStage}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to advance case");
    }
  };

  const handleOverride = async () => {
    if (!overrideToStage) return;
    if (!overrideReason.trim()) {
      toast.error("Override reason is required");
      return;
    }
    try {
      await overrideStage.mutateAsync({
        organizationId: commercialCase.organizationId,
        commercialCaseId: commercialCase.id,
        toStage: overrideToStage,
        overrideReason: overrideReason.trim(),
      });
      toast.success(`Override moved case to ${overrideToStage}`);
      setOverrideDialogOpen(false);
      setOverrideToStage(null);
      setOverrideReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to override stage");
    }
  };

  const handleCreateProposal = async () => {
    if (!proposalTitle.trim()) {
      toast.error("Proposal title is required");
      return;
    }
    if (proposalItems.some((item) => !item.description.trim())) {
      toast.error("Each proposal item needs a description");
      return;
    }

    try {
      const result = await createProposalForCase.mutateAsync({
        organizationId: commercialCase.organizationId,
        commercialCaseId: commercialCase.id,
        leadId: commercialCase.leadId,
        title: proposalTitle,
        items: proposalItems,
        currency: proposalCurrency || commercialCase.currency || "USD",
      });
      toast.success("Proposal created");
      setProposalDialogOpen(false);
      navigate(`/proposals/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create proposal");
    }
  };

  return (
    <div className="py-6 pr-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" className="-ml-2" onClick={() => navigate("/cases")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to cases
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{commercialCase.title}</h1>
          <p className="text-sm text-muted-foreground">
            {commercialCase.companyName || "No company"} · Owner {commercialCase.ownerUserId || "Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setProposalDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/create-invoice?commercialCaseId=${commercialCase.id}`)}
          >
            <Receipt className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
          {nextStage && commercialCase.stage !== COMMERCIAL_CASE_STAGES.LOST ? (
            <Button onClick={handleAdvance} disabled={advanceStage.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Advance to {nextStage}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Stage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CASE_STAGE_ORDER.map((stage) => {
              const isCurrent = stage === commercialCase.stage;
              const canAdvanceTarget =
                !isCurrent &&
                canTransitionCommercialCaseStage(commercialCase.stage, stage);
              return (
                <Badge
                  key={stage}
                  variant={isCurrent ? "default" : "outline"}
                  className={canAdvanceTarget ? "cursor-pointer" : ""}
                  onClick={() => {
                    if (!canAdvanceTarget) return;
                    advanceStage
                      .mutateAsync({
                        organizationId: commercialCase.organizationId,
                        commercialCaseId: commercialCase.id,
                        toStage: stage,
                      })
                      .then(() => toast.success(`Case moved to ${stage}`))
                      .catch((error) =>
                        toast.error(
                          error instanceof Error ? error.message : "Failed to advance case",
                        ),
                      );
                  }}
                >
                  {stage}
                </Badge>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Input
                value={commercialCase.nextAction || ""}
                onChange={(event) =>
                  updateCommercialCase.mutate({
                    id: commercialCase.id,
                    data: { nextAction: event.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Owner User ID</Label>
              <Input
                value={commercialCase.ownerUserId || ""}
                onChange={(event) =>
                  updateCommercialCase.mutate({
                    id: commercialCase.id,
                    data: { ownerUserId: event.target.value || undefined },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Scoped Value</Label>
              <Input
                value={
                  typeof commercialCase.amount === "number"
                    ? String(commercialCase.amount)
                    : ""
                }
                onChange={(event) =>
                  updateCommercialCase.mutate({
                    id: commercialCase.id,
                    data: {
                      amount: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setOverrideToStage(COMMERCIAL_CASE_STAGES.LOST);
                setOverrideDialogOpen(true);
              }}
            >
              Mark Lost
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOverrideToStage(COMMERCIAL_CASE_STAGES.PAID);
                setOverrideDialogOpen(true);
              }}
            >
              Override to Paid
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Linked Proposals ({proposals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {proposals.length === 0 ? (
              <div className="text-sm text-muted-foreground">No proposals linked.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow
                      key={proposal.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/proposals/${proposal.id}`)}
                    >
                      <TableCell>{proposal.title}</TableCell>
                      <TableCell>{proposal.status}</TableCell>
                      <TableCell>
                        {proposal.total} {proposal.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked Invoices ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-sm text-muted-foreground">No invoices linked.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Template</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    >
                      <TableCell>{invoice.id}</TableCell>
                      <TableCell>{invoice.status}</TableCell>
                      <TableCell>{invoice.templateId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caseEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No timeline events yet.</div>
          ) : (
            caseEvents.map((eventItem) => (
              <div key={eventItem.id} className="border rounded-md p-3">
                <div className="text-sm font-medium">{eventItem.type}</div>
                <div className="text-xs text-muted-foreground">
                  {eventItem.fromStage ? `from ${eventItem.fromStage} ` : ""}
                  {eventItem.toStage ? `to ${eventItem.toStage}` : ""}
                  {eventItem.reason ? ` · ${eventItem.reason}` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {eventItem.createdAt || ""}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Proposal for Case</DialogTitle>
            <DialogDescription>
              Proposal will be linked directly to this case thread.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={proposalCurrency}
                onChange={(event) => setProposalCurrency(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Item Description</Label>
              <Input
                value={proposalItems[0]?.description || ""}
                onChange={(event) =>
                  setProposalItems((current) => [
                    {
                      ...(current[0] || { qty: 1, unitPrice: 0, taxPct: 0 }),
                      description: event.target.value,
                    },
                  ])
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={proposalItems[0]?.qty || 1}
                  onChange={(event) =>
                    setProposalItems((current) => [
                      {
                        ...(current[0] || { description: "", unitPrice: 0, taxPct: 0 }),
                        qty: Number(event.target.value || 1),
                      },
                    ])
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  value={proposalItems[0]?.unitPrice || 0}
                  onChange={(event) =>
                    setProposalItems((current) => [
                      {
                        ...(current[0] || { description: "", qty: 1, taxPct: 0 }),
                        unitPrice: Number(event.target.value || 0),
                      },
                    ])
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProposal} disabled={createProposalForCase.isPending}>
              {createProposalForCase.isPending ? "Creating..." : "Create Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Stage</DialogTitle>
            <DialogDescription>
              Overrides require a reason and are fully audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Target Stage</Label>
            <Input value={overrideToStage || ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Override Reason</Label>
            <Input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverride} disabled={overrideStage.isPending}>
              {overrideStage.isPending ? "Applying..." : "Apply Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
