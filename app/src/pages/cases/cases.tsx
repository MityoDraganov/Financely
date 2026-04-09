import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useCommercialCasesByOrg } from "@/hooks/repository-hooks/use-commercial-cases";
import { useCreateCommercialCaseFn } from "@/hooks/service-hooks/use-commercial-case-functions";
import { COMMERCIAL_CASE_STAGES, type CommercialCaseStage } from "@/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

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

export default function CasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganizationContext();
  const { data: cases = [], isLoading } = useCommercialCasesByOrg(currentOrganization?.id);
  const createCommercialCase = useCreateCommercialCaseFn();

  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(
    currentOrganization?.settings?.defaultCurrency || "USD",
  );

  const filteredCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((item) => {
      const haystack = [
        item.title,
        item.companyName,
        item.nextAction,
        item.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [cases, searchTerm]);

  const handleCreateCase = async () => {
    if (!currentOrganization?.id) {
      toast.error("Organization context is required");
      return;
    }
    if (!title.trim()) {
      toast.error("Case title is required");
      return;
    }
    if (!nextAction.trim()) {
      toast.error("Next action is required");
      return;
    }

    try {
      const result = await createCommercialCase.mutateAsync({
        organizationId: currentOrganization.id,
        title: title.trim(),
        companyName: companyName.trim() || undefined,
        nextAction: nextAction.trim(),
        amount: amount.trim() ? Number(amount) : undefined,
        currency: currency.trim() || "USD",
      });
      toast.success("Commercial case created");
      setCreateOpen(false);
      setTitle("");
      setCompanyName("");
      setNextAction("");
      setAmount("");
      navigate(`/cases/${result.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create commercial case",
      );
    }
  };

  return (
    <div className="py-6 pr-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">
            Case-first commercial workspace from intake to paid outcome.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Case
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder={t("proposals.filters.searchPlaceholder")}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commercial Cases</CardTitle>
          <CardDescription>
            {filteredCases.length} active thread{filteredCases.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading cases...</div>
          ) : filteredCases.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No cases found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/cases/${item.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.companyName || "No company"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CASE_STAGE_ORDER.includes(item.stage) ? item.stage : "UNKNOWN"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[340px] truncate">
                      {item.nextAction || "Not set"}
                    </TableCell>
                    <TableCell>
                      {typeof item.amount === "number"
                        ? `${item.amount.toLocaleString()} ${item.currency || ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.updatedAt || item.createdAt || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Commercial Case</DialogTitle>
            <DialogDescription>
              Every proposal and invoice must belong to one case thread.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Input
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Qualify lead and define scope"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCase} disabled={createCommercialCase.isPending}>
              {createCommercialCase.isPending ? "Creating..." : "Create Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
