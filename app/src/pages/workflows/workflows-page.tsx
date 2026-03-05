import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowUpRight,
  LayoutGrid,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivateWorkflow,
  useArchiveWorkflow,
  useDeleteWorkflow,
  usePauseWorkflow,
  useWorkflowsByOrg,
} from "@/hooks";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { Workflow as WorkflowType } from "@/core";
import { useDateFormatting } from "@/hooks/use-date-formatting";

const TRIGGER_LABEL_KEYS: Record<string, string> = {
  "invoice.created": "workflows.triggers.invoicecreated",
  "invoice.sent": "workflows.triggers.invoicesent",
  "invoice.paid": "workflows.triggers.invoicepaid",
  "invoice.overdue": "workflows.triggers.invoiceoverdue",
  "proposal.created": "workflows.triggers.proposalcreated",
  "proposal.sent": "workflows.triggers.proposalsent",
  "proposal.approved": "workflows.triggers.proposalapproved",
  "proposal.rejected": "workflows.triggers.proposalrejected",
  "proposal.convertedToInvoice": "workflows.triggers.proposalconvertedtoinvoice",
  "contract.expiring": "workflows.triggers.contractexpiring",
  "contract.expired": "workflows.triggers.contractexpired",
  "lead.created": "workflows.triggers.leadcreated",
  "lead.converted": "workflows.triggers.leadconverted",
  "lead.qualified": "workflows.triggers.leadqualified",
  "contact.created": "workflows.triggers.contactcreated",
  "contact.updated": "workflows.triggers.contactupdated",
  "product.created": "workflows.triggers.productcreated",
  "product.lowStock": "workflows.triggers.productlowstock",
  "user.joined": "workflows.triggers.userjoined",
  "schedule.cron": "workflows.triggers.schedulecron",
  "webhook.external": "workflows.triggers.webhookexternal",
  "manual.trigger": "workflows.triggers.manualtrigger",
};

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  archived: "border-rose-200 bg-rose-50 text-rose-700",
};

const STATUS_STRIPE_STYLES: Record<string, string> = {
  active: "from-emerald-500/85 to-emerald-400/85",
  paused: "from-amber-500/85 to-amber-400/85",
  draft: "from-slate-500/85 to-slate-400/85",
  archived: "from-rose-500/85 to-rose-400/85",
};

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error";
}

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatDateTable } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowType | null>(null);

  const { data: workflows = [], isLoading, error } = useWorkflowsByOrg(currentOrganization?.id);

  const activateWorkflow = useActivateWorkflow();
  const pauseWorkflow = usePauseWorkflow();
  const archiveWorkflow = useArchiveWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const workflowStats = useMemo(() => {
    return workflows.reduce(
      (acc, workflow) => {
        acc.total += 1;
        if (workflow.status === "active") acc.active += 1;
        if (workflow.status === "draft") acc.draft += 1;
        if (workflow.status === "paused") acc.paused += 1;
        if (workflow.status === "archived") acc.archived += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        draft: 0,
        paused: 0,
        archived: 0,
      }
    );
  }, [workflows]);

  const handleStartCreateWorkflow = () => {
    navigate("/workflows/create");
  };

  const handleEditWorkflow = (workflow: WorkflowType) => {
    navigate(`/workflows/${workflow.id}?mode=edit`);
  };

  const handleDeleteWorkflow = (workflow: WorkflowType) => {
    setWorkflowToDelete(workflow);
  };

  const confirmDeleteWorkflow = () => {
    if (!workflowToDelete) return;

    deleteWorkflow.mutate(workflowToDelete.id);
    setWorkflowToDelete(null);
  };

  const cancelDeleteWorkflow = () => {
    setWorkflowToDelete(null);
  };

  const getStatusLabel = (status: string) => {
    const statusKey = `workflows.status.${status}`;
    return t(statusKey, {
      defaultValue: status.charAt(0).toUpperCase() + status.slice(1),
    });
  };

  const getStatusBadge = (status: string) => {
    const className = STATUS_STYLES[status] || "border-border bg-muted text-foreground";
    return (
      <Badge variant="outline" className={className}>
        {getStatusLabel(status)}
      </Badge>
    );
  };

  const getTriggerTypeLabel = (triggerType: string) => {
    const translationKey = TRIGGER_LABEL_KEYS[triggerType];
    if (translationKey) {
      return t(translationKey);
    }

    return triggerType
      .split(/[._]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    return formatDateTable(timestamp);
  };

  if (isLoading) {
    return (
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/50 px-5 py-5 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("workflows.title")}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t("workflows.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleStartCreateWorkflow}>
              <Plus className="mr-2 h-4 w-4" />
              {t("workflows.create")}
            </Button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("workflows.tabs.workflows")}</p>
                <p className="text-2xl font-semibold text-foreground">{workflowStats.total}</p>
              </div>
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-emerald-200/60 bg-emerald-50/70">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-emerald-700/80">{t("workflows.status.active")}</p>
                <p className="text-2xl font-semibold text-emerald-800">{workflowStats.active}</p>
              </div>
              <Play className="h-5 w-5 text-emerald-700" />
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-slate-100/70">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-slate-700/80">{t("workflows.status.draft")}</p>
                <p className="text-2xl font-semibold text-slate-800">{workflowStats.draft}</p>
              </div>
              <Wrench className="h-5 w-5 text-slate-700" />
            </CardContent>
          </Card>
          <Card className="border-amber-200/70 bg-amber-50/70">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-amber-700/80">{t("workflows.status.paused")}</p>
                <p className="text-2xl font-semibold text-amber-800">{workflowStats.paused}</p>
              </div>
              <Pause className="h-5 w-5 text-amber-700" />
            </CardContent>
          </Card>
          <Card className="border-rose-200/70 bg-rose-50/70">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-rose-700/80">{t("workflows.status.archived")}</p>
                <p className="text-2xl font-semibold text-rose-800">{workflowStats.archived}</p>
              </div>
              <Archive className="h-5 w-5 text-rose-700" />
            </CardContent>
          </Card>
        </div>
      </section>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-700">{getErrorMessage(error)}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button type="button" className="text-left" onClick={handleStartCreateWorkflow}>
          <Card className="group h-full border-dashed border-border/80 bg-muted/20 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg">
            <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Plus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">{t("workflows.create")}</p>
                <p className="text-sm text-muted-foreground">{t("workflows.builder.description.create")}</p>
              </div>
            </CardContent>
          </Card>
        </button>

        {workflows.map((workflow) => (
          <Card
            key={workflow.id}
            className={cn(
              "group relative overflow-hidden border border-border/70 bg-card/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                STATUS_STRIPE_STYLES[workflow.status] || "from-primary/70 to-primary/40"
              )}
            />

            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {getStatusBadge(workflow.status)}
                  {workflow.n8nEnabled && (
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                      n8n
                    </Badge>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => navigate(`/workflows/${workflow.id}`)}>
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      {t("products.actions.view")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEditWorkflow(workflow)}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t("workflows.actions.edit")}
                    </DropdownMenuItem>
                    {workflow.status === "active" ? (
                      <DropdownMenuItem onClick={() => pauseWorkflow.mutate(workflow.id)}>
                        <Pause className="mr-2 h-4 w-4" />
                        {t("workflows.actions.pause")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => activateWorkflow.mutate(workflow.id)}>
                        <Play className="mr-2 h-4 w-4" />
                        {t("workflows.actions.activate")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => archiveWorkflow.mutate(workflow.id)}
                      className="text-orange-600 focus:bg-orange-50 focus:text-orange-700"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {t("workflows.actions.archive")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteWorkflow(workflow)}
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("workflows.actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1.5">
                <CardTitle className="line-clamp-1 text-lg">{workflow.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-10 text-sm">
                  {workflow.description || t("workflows.details.noDescription")}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.details.trigger")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                    {getTriggerTypeLabel(workflow.trigger.type)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.details.steps")}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{workflow.steps.length}</p>
                </div>
              </div>

              {workflow.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {workflow.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {workflow.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      {t("workflows.details.moreTags", { count: workflow.tags.length - 3 })}
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                <p>{t("workflows.details.created", { time: formatTimestamp(workflow.createdAt) })}</p>
                {workflow.updatedAt && workflow.updatedAt !== workflow.createdAt && (
                  <p>{t("workflows.details.updated", { time: formatTimestamp(workflow.updatedAt) })}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button onClick={() => navigate(`/workflows/${workflow.id}`)} className="col-span-1" size="sm">
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                  {t("products.actions.view")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-1"
                  onClick={() => handleEditWorkflow(workflow)}
                >
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  {t("workflows.actions.edit")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workflows.length === 0 && (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("workflows.noWorkflows.description")}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!workflowToDelete} onOpenChange={() => setWorkflowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workflows.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflows.delete.description", { name: workflowToDelete?.name || "" })}
              <br />
              <br />
              <strong>{t("workflows.delete.willRemove")}</strong>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>{t("workflows.delete.willRemoveList.workflow")}</li>
                <li>{t("workflows.delete.willRemoveList.history")}</li>
                <li>{t("workflows.delete.willRemoveList.data")}</li>
              </ul>
              <br />
              <span className="font-medium text-orange-600">{t("workflows.delete.considerArchive")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteWorkflow}>{t("workflows.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteWorkflow}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteWorkflow.isPending}
            >
              {deleteWorkflow.isPending ? t("workflows.delete.deleting") : t("workflows.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
