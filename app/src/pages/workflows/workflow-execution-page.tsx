import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Clock3,
  History,
  Pause,
  Play,
  Settings,
  Sparkles,
  Zap,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workflowService } from "@/services/workflow/workflow-service";
import WorkflowExecutionHistory from "@/components/workflow/workflow-execution-history";
import WorkflowBuilder from "@/components/workflow/workflow-builder";
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

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error";
}

export default function WorkflowExecutionPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showBuilder, setShowBuilder] = useState(searchParams.get("mode") === "edit");

  const isEditMode = searchParams.get("mode") === "edit";

  useEffect(() => {
    setShowBuilder(isEditMode);
  }, [isEditMode]);

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowService.getWorkflow(id || ""),
    enabled: !!id,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["workflow-executions", id],
    queryFn: () => workflowService.listExecutions(id || ""),
    enabled: !!id,
  });

  const activateWorkflow = useMutation({
    mutationFn: (workflowId: string) => workflowService.activateWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  const pauseWorkflow = useMutation({
    mutationFn: (workflowId: string) => workflowService.pauseWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  const archiveWorkflow = useMutation({
    mutationFn: (workflowId: string) => workflowService.archiveWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      navigate("/workflows");
    },
  });

  const executeWorkflow = useMutation({
    mutationFn: (workflowId: string) => workflowService.executeWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", id] });
    },
  });

  const successfulExecutions = useMemo(
    () => executions.filter((execution) => execution.status === "completed").length,
    [executions]
  );

  const openBuilder = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", "edit");
    setSearchParams(nextParams, { replace: true });
    setShowBuilder(true);
  };

  const closeBuilder = () => {
    navigate("/workflows");
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

  if (isLoading) {
    return (
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4">
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="text-rose-700">{t("workflows.execution.notFound.title")}</CardTitle>
            <CardDescription className="text-rose-600">{getErrorMessage(error)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/workflows")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("workflows.execution.notFound.back")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="py-4 sm:py-6 pr-4 sm:pr-6">
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold">{t("workflows.execution.notFound.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("workflows.execution.notFound.description")}</p>
            <Button className="mt-6" onClick={() => navigate("/workflows")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("workflows.execution.notFound.back")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {t("workflows.execution.edit.title")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("workflows.execution.edit.description")}</p>
            </div>
            <Button variant="outline" onClick={closeBuilder}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("workflows.execution.edit.back")}
            </Button>
          </CardContent>
        </Card>

        <WorkflowBuilder editingWorkflow={workflow} onCancelEdit={closeBuilder} />
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <Card className="relative overflow-hidden border-border/70">
        <CardContent className="relative p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => navigate("/workflows")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("workflows.execution.back")}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(workflow.status)}
                <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                  {t("workflows.details.version", { version: workflow.version })}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {workflow.name}
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                  {workflow.description || t("workflows.details.noDescription")}
                </p>
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {getTriggerTypeLabel(workflow.trigger.type)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {workflow.status === "active" ? (
                  <Button
                    variant="outline"
                    onClick={() => pauseWorkflow.mutate(workflow.id)}
                    disabled={pauseWorkflow.isPending}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    {t("workflows.execution.actions.pause")}
                  </Button>
                ) : (
                  <Button onClick={() => activateWorkflow.mutate(workflow.id)} disabled={activateWorkflow.isPending}>
                    <Play className="mr-2 h-4 w-4" />
                    {t("workflows.execution.actions.activate")}
                  </Button>
                )}
                <Button variant="outline" onClick={openBuilder}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t("workflows.execution.actions.edit")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => executeWorkflow.mutate(workflow.id)}
                  disabled={executeWorkflow.isPending}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {t("workflows.execution.actions.testRun")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-blue-200/60 bg-blue-50/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-blue-700/80">{t("workflows.execution.stats.steps")}</p>
                <p className="text-2xl font-semibold text-blue-800">{workflow.steps.length}</p>
              </div>
              <Zap className="h-5 w-5 text-blue-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/60 bg-emerald-50/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-emerald-700/80">{t("workflows.execution.stats.executions")}</p>
                <p className="text-2xl font-semibold text-emerald-800">{executions.length}</p>
              </div>
              <History className="h-5 w-5 text-emerald-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 bg-amber-50/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-amber-700/80">{t("workflows.execution.stats.version")}</p>
                <p className="text-2xl font-semibold text-amber-800">{workflow.version}</p>
              </div>
              <Clock3 className="h-5 w-5 text-amber-700" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200/60 bg-violet-50/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-violet-700/80">{t("workflows.execution.tabs.execution")}</p>
                <p className="text-2xl font-semibold text-violet-800">{successfulExecutions}</p>
              </div>
              <Play className="h-5 w-5 text-violet-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap items-stretch justify-start rounded-xl border border-border/70 bg-muted/50 p-1.5">
          <TabsTrigger value="overview" className="min-h-10 flex-1 sm:flex-none sm:px-4">
            <Sparkles className="h-4 w-4" />
            {t("workflows.execution.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="execution" className="min-h-10 flex-1 sm:flex-none sm:px-4">
            <History className="h-4 w-4" />
            {t("workflows.execution.tabs.execution")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-10 flex-1 sm:flex-none sm:px-4">
            <Settings className="h-4 w-4" />
            {t("workflows.execution.tabs.settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-border/70 xl:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle>{t("workflows.execution.overview.details.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {t("workflows.execution.overview.details.status")}
                  </span>
                  {getStatusBadge(workflow.status)}
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {t("workflows.execution.overview.details.trigger")}
                  </span>
                  <span className="text-right text-sm font-medium text-foreground">
                    {getTriggerTypeLabel(workflow.trigger.type)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {t("workflows.execution.overview.details.steps")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{workflow.steps.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {t("workflows.execution.overview.details.created")}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {workflow.createdAt ? formatDateTable(workflow.createdAt) : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm font-medium text-foreground">
                    {workflow.updatedAt ? formatDateTable(workflow.updatedAt) : "N/A"}
                  </span>
                </div>

                {workflow.tags.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="mb-2 text-sm text-muted-foreground">
                      {t("workflows.execution.overview.details.tags")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {workflow.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 xl:col-span-2">
              <CardHeader>
                <CardTitle>{t("workflows.execution.overview.steps.title")}</CardTitle>
                <CardDescription>{t("workflows.execution.overview.steps.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {workflow.steps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No steps configured yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflow.steps.map((step, index) => (
                      <div key={step.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium text-foreground">{step.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {step.actions.length === 1
                                ? t("workflows.execution.overview.steps.actions", {
                                    count: step.actions.length,
                                  })
                                : t("workflows.execution.overview.steps.actionsPlural", {
                                    count: step.actions.length,
                                  })}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {step.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="execution">
          <WorkflowExecutionHistory workflowId={workflow.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>{t("workflows.execution.settings.title")}</CardTitle>
              <CardDescription>{t("workflows.execution.settings.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.execution.settings.maxRetries")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{workflow.settings.maxRetries}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.execution.settings.timeout")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {workflow.settings.timeoutSeconds}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.execution.settings.maxConcurrent")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {workflow.settings.maxConcurrentExecutions}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("workflows.execution.settings.notifyOnFailure")}
                  </p>
                  <p className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        workflow.settings.notifyOnFailure
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      )}
                    >
                      {workflow.settings.notifyOnFailure
                        ? t("workflows.execution.settings.yes")
                        : t("workflows.execution.settings.no")}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/70">
            <CardHeader>
              <CardTitle className="text-rose-700">
                {t("workflows.execution.settings.dangerZone.title")}
              </CardTitle>
              <CardDescription className="text-rose-600">
                {t("workflows.execution.settings.dangerZone.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => archiveWorkflow.mutate(workflow.id)}
                disabled={archiveWorkflow.isPending}
              >
                <Archive className="mr-2 h-4 w-4" />
                {t("workflows.execution.settings.dangerZone.archive")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
