import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, Archive, Settings, History, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workflowService } from "@/services/workflow/workflow-service";
import WorkflowExecutionHistory from "@/components/workflow/workflow-execution-history";
import WorkflowBuilder from "@/components/workflow/workflow-builder";
import { useDateFormatting } from "@/hooks/use-date-formatting";

export default function WorkflowExecutionPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showBuilder, setShowBuilder] = useState(false);

  // Fetch workflow
  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowService.getWorkflow(id || ""),
    enabled: !!id,
  });

  // Activate workflow mutation
  const activateWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.activateWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Pause workflow mutation
  const pauseWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.pauseWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Archive workflow mutation
  const archiveWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.archiveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      navigate("/workflows");
    },
  });

  // Execute workflow mutation
  const executeWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.executeWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", id] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('workflows.status.active')}</Badge>;
      case "paused":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('workflows.status.paused')}</Badge>;
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">{t('workflows.status.draft')}</Badge>;
      case "archived":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">{t('workflows.status.archived')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerTypeLabel = (triggerType: string) => {
    const triggerMap: Record<string, string> = {
      "invoice.created": t('workflows.triggers.invoiceCreated'),
      "invoice.sent": t('workflows.triggers.invoiceSent'),
      "invoice.paid": t('workflows.triggers.invoicePaid'),
      "invoice.overdue": t('workflows.triggers.invoiceOverdue'),
      "proposal.created": t('workflows.triggers.proposalCreated'),
      "proposal.approved": t('workflows.triggers.proposalApproved'),
      "contract.expiring": t('workflows.triggers.contractExpiring'),
      "contract.expired": t('workflows.triggers.contractExpired'),
      "user.joined": t('workflows.triggers.userJoined'),
      "schedule.cron": t('workflows.triggers.scheduled'),
      "webhook.external": t('workflows.triggers.webhook'),
      "manual.trigger": t('workflows.triggers.manual'),
    };
    return triggerMap[triggerType] || triggerType;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('workflows.execution.loading')}</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{t('workflows.execution.notFound.title')}</h2>
          <p className="text-muted-foreground">
            {t('workflows.execution.notFound.description')}
          </p>
        </div>
        <Button onClick={() => navigate("/workflows")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('workflows.execution.notFound.back')}
        </Button>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setShowBuilder(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('workflows.execution.edit.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('workflows.execution.edit.title')}</h1>
            <p className="text-muted-foreground">
              {t('workflows.execution.edit.description')}
            </p>
          </div>
        </div>

        <WorkflowBuilder
          editingWorkflow={workflow}
          onCancelEdit={() => setShowBuilder(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/workflows")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('workflows.execution.back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <p className="text-muted-foreground">
              {workflow.description || t('workflows.details.noDescription')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workflow.status === "active" ? (
            <Button
              variant="outline"
              onClick={() => pauseWorkflow.mutate(workflow.id)}
              disabled={pauseWorkflow.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              {t('workflows.execution.actions.pause')}
            </Button>
          ) : (
            <Button
              onClick={() => activateWorkflow.mutate(workflow.id)}
              disabled={activateWorkflow.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {t('workflows.execution.actions.activate')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowBuilder(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            {t('workflows.execution.actions.edit')}
          </Button>
          <Button
            variant="outline"
            onClick={() => executeWorkflow.mutate(workflow.id)}
            disabled={executeWorkflow.isPending}
          >
            <Zap className="w-4 h-4 mr-2" />
            {t('workflows.execution.actions.testRun')}
          </Button>
        </div>
      </div>

      {/* Workflow Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{workflow.steps.length}</div>
                <div className="text-sm text-muted-foreground">{t('workflows.execution.stats.steps')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{t('workflows.details.version', { version: workflow.version })}</div>
                <div className="text-sm text-muted-foreground">{t('workflows.execution.stats.version')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {getTriggerTypeLabel(workflow.trigger.type)}
                </div>
                <div className="text-sm text-muted-foreground">{t('workflows.execution.stats.trigger')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <History className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">{t('workflows.execution.stats.executions')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('workflows.execution.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="execution">{t('workflows.execution.tabs.execution')}</TabsTrigger>
          <TabsTrigger value="settings">{t('workflows.execution.tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workflow Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workflows.execution.overview.details.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('workflows.execution.overview.details.status')}</span>
                  {getStatusBadge(workflow.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('workflows.execution.overview.details.trigger')}</span>
                  <span className="font-medium">
                    {getTriggerTypeLabel(workflow.trigger.type)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('workflows.execution.overview.details.steps')}</span>
                  <span className="font-medium">{workflow.steps.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('workflows.execution.overview.details.created')}</span>
                  <span className="font-medium">
                    {workflow.createdAt ? formatDateTable(workflow.createdAt) : 'N/A'}
                  </span>
                </div>
                {workflow.tags.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t('workflows.execution.overview.details.tags')}</span>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
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

            {/* Workflow Steps */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workflows.execution.overview.steps.title')}</CardTitle>
                <CardDescription>
                  {t('workflows.execution.overview.steps.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {step.actions.length === 1 
                            ? t('workflows.execution.overview.steps.actions', { count: step.actions.length })
                            : t('workflows.execution.overview.steps.actionsPlural', { count: step.actions.length })
                          }
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {step.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="execution">
          <WorkflowExecutionHistory workflowId={workflow.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('workflows.execution.settings.title')}</CardTitle>
              <CardDescription>
                {t('workflows.execution.settings.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{t('workflows.execution.settings.maxRetries')}</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.maxRetries}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('workflows.execution.settings.timeout')}</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.timeoutSeconds}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('workflows.execution.settings.maxConcurrent')}</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.maxConcurrentExecutions}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('workflows.execution.settings.notifyOnFailure')}</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.notifyOnFailure ? t('workflows.execution.settings.yes') : t('workflows.execution.settings.no')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('workflows.execution.settings.dangerZone.title')}</CardTitle>
              <CardDescription>
                {t('workflows.execution.settings.dangerZone.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => archiveWorkflow.mutate(workflow.id)}
                disabled={archiveWorkflow.isPending}
              >
                <Archive className="w-4 h-4 mr-2" />
                {t('workflows.execution.settings.dangerZone.archive')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
